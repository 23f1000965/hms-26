from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..models import db, User, DoctorProfile, PatientProfile, Appointment, Department, DoctorAvailability
from datetime import datetime, timedelta, time

doctor_bp = Blueprint('doctor', __name__)

def _get_authorized_doctor():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return None, (jsonify({'message': 'Doctor access required'}), 403)

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return None, (jsonify({'message': 'Doctor profile not found'}), 404)

    return doctor, None

# Doctor dashboard with upcoming appointments
@doctor_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_doctor_dashboard():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404

    # Upcoming appointments for today and next 7 days
    today = datetime.utcnow().date()
    next_week = today + timedelta(days=7)
    appointments = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.date >= today,
        Appointment.date <= next_week
    ).order_by(Appointment.date, Appointment.time).all()

    upcoming = []
    for appt in appointments:
        upcoming.append({
            'id': appt.id,
            'patient_name': appt.patient.user.username,
            'date': appt.date.isoformat(),
            'time': appt.time.isoformat(),
            'status': appt.status,
            'notes': appt.notes
        })

    return jsonify({
        'upcoming_appointments': upcoming,
        'total_upcoming': len(upcoming)
    }), 200

# Get patients assigned to this doctor
@doctor_bp.route('/patients', methods=['GET'])
@jwt_required()
def get_assigned_patients():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404

    # Patients with appointments to this doctor
    patient_ids = db.session.query(Appointment.patient_id).filter(
        Appointment.doctor_id == doctor.id
    ).distinct().all()
    patient_ids = [p[0] for p in patient_ids]

    patients = PatientProfile.query.filter(PatientProfile.user_id.in_(patient_ids)).all()
    result = [p.to_dict() for p in patients]
    return jsonify(result), 200

# Update appointment status or notes
@doctor_bp.route('/appointments/<int:appt_id>', methods=['PUT'])
@jwt_required()
def update_appointment(appt_id):
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    appt = Appointment.query.get(appt_id)
    if not appt or appt.doctor_id != doctor.id:
        return jsonify({'message': 'Appointment not found or not assigned'}), 404

    data = request.get_json()
    appt.status = data.get('status', appt.status)
    appt.notes = data.get('notes', appt.notes)
    db.session.commit()
    return jsonify({'message': 'Appointment updated'}), 200

# Get doctor profile
@doctor_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_doctor_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404
    return jsonify(doctor.to_dict()), 200

# Update doctor profile
@doctor_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_doctor_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404

    data = request.get_json()
    doctor.user.username = data.get('username', doctor.user.username)
    doctor.user.email = data.get('email', doctor.user.email)
    doctor.license_number = data.get('license_number', doctor.license_number)
    # Department update if needed
    if 'department_id' in data:
        doctor.department_id = data['department_id']
    db.session.commit()
    return jsonify({'message': 'Profile updated'}), 200

# Get notifications 
@doctor_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'DOCTOR' or not user.is_active:
        return jsonify({'message': 'Doctor access required'}), 403

    doctor = DoctorProfile.query.filter_by(user_id=user_id).first()
    if not doctor:
        return jsonify({'message': 'Doctor profile not found'}), 404

    # Simple notifications: recent appointments or updates
    today = datetime.utcnow().date()
    recent_appts = Appointment.query.filter(
        Appointment.doctor_id == doctor.id,
        Appointment.date >= today - timedelta(days=1)
    ).order_by(Appointment.date.desc()).limit(5).all()

    notifications = []
    for appt in recent_appts:
        notifications.append({
            'type': 'appointment',
            'message': f'Appointment with {appt.patient.user.username} on {appt.date}',
            'date': appt.date.isoformat()
        })

    return jsonify(notifications), 200

@doctor_bp.route('/availability', methods=['GET'])
@jwt_required()
def get_doctor_availability():
    doctor, error = _get_authorized_doctor()
    if error:
        return error

    start_date = datetime.utcnow().date() + timedelta(days=1)
    days = [start_date + timedelta(days=offset) for offset in range(7)]

    saved_slots = DoctorAvailability.query.filter(
        DoctorAvailability.doctor_id == doctor.id,
        DoctorAvailability.date >= start_date,
        DoctorAvailability.date <= days[-1]
    ).all()

    slot_lookup = {}
    for slot in saved_slots:
        key = (slot.date.isoformat(), slot.start_time.isoformat(), slot.end_time.isoformat())
        slot_lookup[key] = slot

    availability = []
    for current_day in days:
        date_key = current_day.isoformat()
        morning = slot_lookup.get((date_key, '10:00:00', '13:00:00'))
        evening = slot_lookup.get((date_key, '15:00:00', '19:00:00'))
        availability.append({
            'date': date_key,
            'morning': {
                'label': '10:00 AM - 1:00 PM',
                'start_time': '10:00:00',
                'end_time': '13:00:00',
                'is_available': bool(morning and morning.is_available)
            },
            'evening': {
                'label': '3:00 PM - 7:00 PM',
                'start_time': '15:00:00',
                'end_time': '19:00:00',
                'is_available': bool(evening and evening.is_available)
            }
        })

    return jsonify({'availability': availability}), 200


@doctor_bp.route('/availability', methods=['PUT'])
@jwt_required()
def save_doctor_availability():
    doctor, error = _get_authorized_doctor()
    if error:
        return error

    data = request.get_json() or {}
    availability = data.get('availability', [])
    if not isinstance(availability, list):
        return jsonify({'message': 'availability must be an array'}), 400

    for item in availability:
        date_text = item.get('date')
        if not date_text:
            continue

        try:
            slot_date = datetime.fromisoformat(date_text).date()
        except ValueError:
            return jsonify({'message': f'Invalid date format: {date_text}'}), 400

        morning_available = bool(item.get('morning_available', False))
        evening_available = bool(item.get('evening_available', False))

        morning_slot = DoctorAvailability.query.filter_by(
            doctor_id=doctor.id,
            date=slot_date,
            start_time=time(10, 0),
            end_time=time(13, 0)
        ).first()
        if not morning_slot:
            morning_slot = DoctorAvailability(
                doctor_id=doctor.id,
                date=slot_date,
                start_time=time(10, 0),
                end_time=time(13, 0)
            )
            db.session.add(morning_slot)
        morning_slot.is_available = morning_available

        evening_slot = DoctorAvailability.query.filter_by(
            doctor_id=doctor.id,
            date=slot_date,
            start_time=time(15, 0),
            end_time=time(19, 0)
        ).first()
        if not evening_slot:
            evening_slot = DoctorAvailability(
                doctor_id=doctor.id,
                date=slot_date,
                start_time=time(15, 0),
                end_time=time(19, 0)
            )
            db.session.add(evening_slot)
        evening_slot.is_available = evening_available

    db.session.commit()
    return jsonify({'message': 'Availability saved successfully'}), 200