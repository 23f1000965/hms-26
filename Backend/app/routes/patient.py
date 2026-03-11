from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta, time
import json
from sqlalchemy.exc import IntegrityError
from ..models import db, User, PatientProfile, DoctorProfile, Appointment, DoctorAvailability, Department, Treatment
from celery import Celery
from celery.result import AsyncResult
import os
from ..app import cache


patient_bp = Blueprint('patient', __name__)

def _get_celery_client():
	broker_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
	backend_url = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
	return Celery('hms_client', broker=broker_url, backend=backend_url)

def _get_authorized_patient():
	user_id = int(get_jwt_identity())
	user = User.query.get(user_id)
	if not user or user.role != 'PATIENT' or not user.is_active:
		return None, None, (jsonify({'message': 'Patient access required'}), 403)

	patient = PatientProfile.query.filter_by(user_id=user_id).first()
	if not patient:
		return None, None, (jsonify({'message': 'Patient profile not found'}), 404)

	return user, patient, None

def _format_slot_label(start_time, end_time):
	def _to_ampm(value):
		hour = value.hour
		minute = value.minute
		suffix = 'AM' if hour < 12 else 'PM'
		hour12 = hour % 12
		if hour12 == 0:
			hour12 = 12
		return f"{hour12}:{minute:02d} {suffix}"

	return f"{_to_ampm(start_time)} - {_to_ampm(end_time)}"

# Patient dashboard
@patient_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@cache.cached(timeout=60, key_prefix=lambda: f"patient:dashboard:{get_jwt_identity()}")
def get_patient_dashboard():
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	departments = Department.query.order_by(Department.name.asc()).all()
	departments_data = [
		{
			'id': dept.id,
			'name': dept.name,
			'description': dept.description,
		}
		for dept in departments
	]

	upcoming_count = Appointment.query.filter(
		Appointment.patient_id == patient.id,
		Appointment.status == 'BOOKED'
	).count()

	completed_count = Appointment.query.filter(
		Appointment.patient_id == patient.id,
		Appointment.status == 'COMPLETED'
	).count()

	upcoming_appointments = Appointment.query.filter(
		Appointment.patient_id == patient.id,
		Appointment.status == 'BOOKED'
	).order_by(Appointment.date.asc(), Appointment.time.asc()).all()

	upcoming_rows = []
	for appt in upcoming_appointments:
		upcoming_rows.append({
			'id': appt.id,
			'doctor_name': appt.doctor.user.username,
			'department': appt.doctor.department.name,
			'date': appt.date.isoformat(),
			'time': appt.time.isoformat(),
			'status': appt.status,
		})

	return jsonify({
		'upcoming_appointments': upcoming_count,
		'completed_appointments': completed_count,
		'departments': departments_data,
		'upcoming_rows': upcoming_rows
	}), 200

# Departments 
@patient_bp.route('/departments', methods=['GET'])
@jwt_required()
def get_departments():
	_, _, error = _get_authorized_patient()
	if error:
		return error

	departments = Department.query.order_by(Department.name.asc()).all()
	result = []
	for dept in departments:
		result.append({
			'id': dept.id,
			'name': dept.name,
			'description': dept.description,
		})
	return jsonify(result), 200

# Department details with doctors
@patient_bp.route('/departments/<int:department_id>', methods=['GET'])
@jwt_required()
def get_department_details(department_id):
	_, _, error = _get_authorized_patient()
	if error:
		return error

	department = Department.query.get(department_id)
	if not department:
		return jsonify({'message': 'Department not found'}), 404

	doctors = DoctorProfile.query.join(User).filter(
		DoctorProfile.department_id == department.id,
		User.is_active == True
	).all()

	doctor_rows = []
	for doctor in doctors:
		doctor_rows.append({
			'id': doctor.id,
			'username': doctor.user.username,
			'email': doctor.user.email,
			'license_number': doctor.license_number,
		})

	return jsonify({
		'id': department.id,
		'name': department.name,
		'description': department.description,
		'doctors': doctor_rows,
	}), 200

# Doctor list for patients
@patient_bp.route('/doctors', methods=['GET'])
@jwt_required()
def get_doctors_for_patient():
	_, _, error = _get_authorized_patient()
	if error:
		return error

	doctors = DoctorProfile.query.join(User).filter(User.is_active == True).all()
	result = [
		{
			'id': doctor.id,
			'username': doctor.user.username,
			'email': doctor.user.email,
			'department': doctor.department.name,
			'license_number': doctor.license_number
		}
		for doctor in doctors
	]
	return jsonify(result), 200

# Doctor details for patients
@patient_bp.route('/doctors/<int:doctor_id>', methods=['GET'])
@jwt_required()
def get_doctor_details(doctor_id):
	_, _, error = _get_authorized_patient()
	if error:
		return error

	doctor = DoctorProfile.query.get(doctor_id)
	if not doctor or not doctor.user.is_active:
		return jsonify({'message': 'Doctor not found'}), 404

	total_appointments = Appointment.query.filter_by(doctor_id=doctor.id).count()

	return jsonify({
		'id': doctor.id,
		'username': doctor.user.username,
		'email': doctor.user.email,
		'department': doctor.department.name,
		'license_number': doctor.license_number,
		'experience_years': total_appointments,
		'bio': f"{doctor.user.username} is a specialist in {doctor.department.name}."
	}), 200

# Get Doctor Availability For Patients 
@patient_bp.route('/doctors/<int:doctor_id>/availability', methods=['GET'])
@jwt_required()
def get_doctor_public_availability(doctor_id):
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	doctor = DoctorProfile.query.get(doctor_id)
	if not doctor or not doctor.user.is_active:
		return jsonify({'message': 'Doctor not found'}), 404

	start_date = datetime.utcnow().date() 
	days = [start_date + timedelta(days=offset) for offset in range(7)]

	availability_rows = DoctorAvailability.query.filter(
		DoctorAvailability.doctor_id == doctor.id,
		DoctorAvailability.date >= start_date,
		DoctorAvailability.date <= days[-1]
	).order_by(DoctorAvailability.date.asc(), DoctorAvailability.start_time.asc()).all()

	booked_rows = Appointment.query.filter(
		Appointment.doctor_id == doctor.id,
		Appointment.date >= start_date,
		Appointment.date <= days[-1],
		Appointment.status == 'BOOKED'
	).all()

	booked_lookup = {}
	for booked in booked_rows:
		booked_lookup[(booked.date.isoformat(), booked.time.isoformat())] = booked

	grouped = {}
	for row in availability_rows:
		date_key = row.date.isoformat()
		if date_key not in grouped:
			grouped[date_key] = []

		booking = booked_lookup.get((date_key, row.start_time.isoformat()))
		booking_status = 'AVAILABLE'
		if booking:
			booking_status = 'BOOKED_BY_YOU' if booking.patient_id == patient.id else 'BOOKED'

		grouped[date_key].append({
			'start_time': row.start_time.isoformat(),
			'end_time': row.end_time.isoformat(),
			'label': _format_slot_label(row.start_time, row.end_time),
			'is_available': bool(row.is_available) and not booking,
			'booking_status': booking_status
		})

	availability = []
	for current_day in days:
		date_key = current_day.isoformat()
		slots = [
			{
				'start_time': '10:00:00',
				'end_time': '13:00:00',
				'label': '10:00 AM - 1:00 PM',
				'is_available': False,
				'booking_status': 'UNAVAILABLE'
			},
			{
				'start_time': '15:00:00',
				'end_time': '19:00:00',
				'label': '3:00 PM - 7:00 PM',
				'is_available': False,
				'booking_status': 'UNAVAILABLE'
			}
		]

		for saved_slot in grouped.get(date_key, []):
			for slot in slots:
				if slot['start_time'] == saved_slot['start_time'] and slot['end_time'] == saved_slot['end_time']:
					slot['is_available'] = saved_slot['is_available']
					slot['booking_status'] = saved_slot.get('booking_status', 'AVAILABLE')
					break

		availability.append({
			'date': date_key,
			'slots': slots
		})

	return jsonify({'availability': availability}), 200

# Patient appointment booking
@patient_bp.route('/appointments', methods=['POST'])
@jwt_required()
def book_appointment():
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	data = request.get_json() or {}
	doctor_id = data.get('doctor_id')
	date_text = data.get('date')
	start_time_text = data.get('start_time')
	end_time_text = data.get('end_time')

	if not doctor_id or not date_text or not start_time_text or not end_time_text:
		return jsonify({'message': 'doctor_id, date, start_time and end_time are required'}), 400

	try:
		selected_date = datetime.fromisoformat(date_text).date()
	except ValueError:
		return jsonify({'message': 'Invalid date format'}), 400

	try:
		start_time = time.fromisoformat(start_time_text)
		end_time = time.fromisoformat(end_time_text)
	except ValueError:
		return jsonify({'message': 'Invalid start_time or end_time format'}), 400

	existing_patient_slot = Appointment.query.filter_by(
		patient_id=patient.id,
		date=selected_date,
		time=start_time,
		status='BOOKED'
	).first()
	if existing_patient_slot:
		return jsonify({'message': 'At this slot you already booked with another doctor'}), 400

	doctor = DoctorProfile.query.get(doctor_id)
	if not doctor or not doctor.user.is_active:
		return jsonify({'message': 'Doctor not found'}), 404

	slot_is_available = DoctorAvailability.query.filter_by(
		doctor_id=doctor.id,
		date=selected_date,
		start_time=start_time,
		end_time=end_time,
		is_available=True
	).first()
	if not slot_is_available:
		return jsonify({'message': 'Selected slot is not available'}), 400

	existing_appt = Appointment.query.filter_by(
		doctor_id=doctor.id,
		date=selected_date,
		time=start_time
	).first()
	if existing_appt:
		if existing_appt.status == 'BOOKED':
			return jsonify({'message': 'This slot is already booked'}), 400

		if existing_appt.status == 'CANCELLED':
			now_utc = datetime.utcnow()
			slot_datetime = datetime.combine(selected_date, start_time)

			if slot_datetime > now_utc:
				existing_appt.patient_id = patient.id
				existing_appt.status = 'BOOKED'
				try:
					db.session.commit()
				except IntegrityError:
					db.session.rollback()
					return jsonify({'message': 'This slot is already booked'}), 400
				return jsonify({'message': 'Appointment booked successfully'}), 201

			return jsonify({'message': 'Book failed try another slot'}), 400

	appointment = Appointment(
		doctor_id=doctor.id,
		patient_id=patient.id,
		date=selected_date,
		time=start_time,
		status='BOOKED'
	)
	db.session.add(appointment)
	try:
		db.session.commit()
	except IntegrityError:
		db.session.rollback()
		return jsonify({'message': 'This slot is already booked'}), 400

	return jsonify({'message': 'Appointment booked successfully'}), 201

# Get patient appointments
@patient_bp.route('/appointments', methods=['GET'])
@jwt_required()
def get_my_appointments():
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	appointments = Appointment.query.filter_by(patient_id=patient.id).order_by(
		Appointment.date.desc(), Appointment.time.desc()
	).all()

	result = []
	for appt in appointments:
		result.append({
			'id': appt.id,
			'doctor_name': appt.doctor.user.username,
			'department': appt.doctor.department.name,
			'date': appt.date.isoformat(),
			'time': appt.time.isoformat(),
			'status': appt.status
		})
	return jsonify(result), 200


@patient_bp.route('/history', methods=['GET'])
@jwt_required()
def get_patient_history():
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	appointments = Appointment.query.filter_by(patient_id=patient.id).order_by(
		Appointment.date.desc(), Appointment.time.desc()
	).all()

	history_rows = []
	for appt in appointments:
		treatments = Treatment.query.filter_by(appointment_id=appt.id).all()
		if not treatments:
			history_rows.append({
				'appointment_id': appt.id,
				'doctor_name': appt.doctor.user.username,
				'department': appt.doctor.department.name,
				'date': appt.date.isoformat(),
				'time': appt.time.isoformat(),
				'status': appt.status,
				'visit_type': 'In-person',
				'tests_done': '-',
				'diagnosis': '-',
				'prescription': '-',
				'medicines': '-',
			})
			continue

		for treatment in treatments:
			if treatment.medicines:
				try:
					parsed_medicines = json.loads(treatment.medicines)
					if isinstance(parsed_medicines, list):
						formatted = []
						for med in parsed_medicines:
							if isinstance(med, dict):
								name = str(med.get('name', '')).strip()
								if not name:
									continue
								dosage = f"{med.get('morning', '-') or '-'}-{med.get('afternoon', '-') or '-'}-{med.get('night', '-') or '-'}"
								formatted.append(f"{name} ({dosage})")
							else:
								text = str(med).strip()
								if text:
									formatted.append(text)
						medicines_text = ', '.join(formatted) if formatted else '-'
					else:
						medicines_text = treatment.medicines
				except Exception:
					medicines_text = treatment.medicines
			else:
				medicines_text = '-'
			history_rows.append({
				'appointment_id': appt.id,
				'doctor_name': appt.doctor.user.username,
				'department': appt.doctor.department.name,
				'date': appt.date.isoformat(),
				'time': appt.time.isoformat(),
				'status': appt.status,
				'visit_type': treatment.visit_type or 'In-person',
				'tests_done': treatment.tests_done or '-',
				'diagnosis': treatment.diagnosis or '-',
				'prescription': treatment.prescription or '-',
				'medicines': medicines_text,
			})

	return jsonify(history_rows), 200

# Patient appointment cancellation
@patient_bp.route('/appointments/<int:appointment_id>/cancel', methods=['PUT'])
@jwt_required()
def cancel_appointment(appointment_id):
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	appointment = Appointment.query.get(appointment_id)
	if not appointment or appointment.patient_id != patient.id:
		return jsonify({'message': 'Appointment not found'}), 404

	if appointment.status != 'BOOKED':
		return jsonify({'message': 'Only booked appointments can be cancelled'}), 400

	appointment.status = 'CANCELLED'
	db.session.commit()
	return jsonify({'message': 'Appointment cancelled successfully'}), 200


@patient_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_patient_profile():
	user, patient, error = _get_authorized_patient()
	if error:
		return error

	return jsonify({
		'username': user.username,
		'email': user.email,
		'date_of_birth': patient.date_of_birth.isoformat() if patient.date_of_birth else None,
		'phone': patient.phone,
		'address': patient.address,
		'emergency_contact': patient.emergency_contact
	}), 200

# Patient profile update
@patient_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_patient_profile():
	user, patient, error = _get_authorized_patient()
	if error:
		return error

	data = request.get_json() or {}
	user.username = data.get('username', user.username)
	user.email = data.get('email', user.email)
	patient.phone = data.get('phone', patient.phone)
	patient.address = data.get('address', patient.address)
	patient.emergency_contact = data.get('emergency_contact', patient.emergency_contact)

	dob_text = data.get('date_of_birth')
	if dob_text:
		try:
			patient.date_of_birth = datetime.fromisoformat(dob_text).date()
		except ValueError:
			return jsonify({'message': 'Invalid date_of_birth format'}), 400

	db.session.commit()
	return jsonify({'message': 'Profile updated successfully'}), 200


@patient_bp.route('/exports/history-csv', methods=['POST'])
@jwt_required()
def trigger_history_csv_export():
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	celery_client = _get_celery_client()
	task = celery_client.send_task('tasks.export_patient_history_csv', args=[patient.id])

	return jsonify({
		'message': 'CSV export started',
		'task_id': task.id
	}), 202


@patient_bp.route('/exports/history-csv/<string:task_id>', methods=['GET'])
@jwt_required()
def get_history_csv_export_status(task_id):
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	celery_client = _get_celery_client()
	result = AsyncResult(task_id, app=celery_client)

	response = {
		'task_id': task_id,
		'status': result.status,
	}

	if result.successful():
		payload = result.result if isinstance(result.result, dict) else {}
		if payload.get('patient_id') != patient.id:
			return jsonify({'message': 'Access denied for this export task'}), 403

		response['result'] = {
			'message': payload.get('message'),
		}
	elif result.failed():
		response['error'] = str(result.result)

	return jsonify(response), 200

@patient_bp.route('/exports/history-csv/<string:task_id>/download', methods=['GET'])
@jwt_required()
def download_history_csv_export(task_id):
	_, patient, error = _get_authorized_patient()
	if error:
		return error

	celery_client = _get_celery_client()
	result = AsyncResult(task_id, app=celery_client)

	if not result.successful():
		return jsonify({'message': 'Export is not ready yet'}), 400

	payload = result.result if isinstance(result.result, dict) else {}
	if payload.get('patient_id') != patient.id:
		return jsonify({'message': 'Access denied for this export task'}), 403

	file_path = payload.get('file_path')
	if not file_path or not os.path.exists(file_path):
		return jsonify({'message': 'Export file not found'}), 404

	return send_file(file_path, as_attachment=True, download_name='history.csv', mimetype='text/csv')

