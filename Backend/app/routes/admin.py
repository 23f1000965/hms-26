from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from ..models import db, User, DoctorProfile, PatientProfile, Appointment, Department
from werkzeug.security import generate_password_hash
from sqlalchemy import func

admin_bp = Blueprint('admin', __name__)

# admin can access all routes in this blueprint
@admin_bp.before_request
def require_admin():
    if request.method == 'OPTIONS':
        return
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role != 'ADMIN':
        return jsonify({'message': 'Admin access required'}), 403

# Dashboard stats
@admin_bp.route('/dashboard', methods=['GET'])
def get_dashboard_stats():
    total_doctors = DoctorProfile.query.count()
    total_patients = PatientProfile.query.count()
    total_appointments = Appointment.query.count()
    
    return jsonify({
        'total_doctors': total_doctors,
        'total_patients': total_patients,
        'total_appointments': total_appointments
    }), 200

# Doctor fetches and management
@admin_bp.route('/doctors', methods=['GET'])
def get_doctors():
    doctors = DoctorProfile.query.all()
    result = []
    for doctor in doctors:
        result.append(doctor.to_dict())
    return jsonify(result), 200

# Add new doctor
@admin_bp.route('/doctors', methods=['POST'])
def add_doctor():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    department_id = data.get('department_id')
    license_number = data.get('license_number')

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Email already exists'}), 400

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        role='DOCTOR'
    )
    db.session.add(user)
    db.session.commit()

    doctor = DoctorProfile(
        user_id=user.id,
        department_id=department_id,
        license_number=license_number
    )
    db.session.add(doctor)
    db.session.commit()

    return jsonify({'message': 'Doctor added successfully', 'doctor': doctor.to_dict()}), 201

# Get doctor details
@admin_bp.route('/doctors/<int:doctor_id>', methods=['GET'])
def get_doctor(doctor_id):
    doctor = DoctorProfile.query.get(doctor_id)
    if not doctor:
        return jsonify({'message': 'Doctor not found'}), 404
    return jsonify(doctor.to_dict()), 200

# Update doctor details
@admin_bp.route('/doctors/<int:doctor_id>', methods=['PUT'])
def update_doctor(doctor_id):
    doctor = DoctorProfile.query.get(doctor_id)
    if not doctor:
        return jsonify({'message': 'Doctor not found'}), 404

    data = request.get_json()
    # Update user fields
    if 'username' in data:
        doctor.user.username = data['username']
    if 'email' in data:
        doctor.user.email = data['email']
    # Update doctor fields
    doctor.license_number = data.get('license_number', doctor.license_number)
    if 'department_id' in data:
        doctor.department_id = data['department_id']

    db.session.commit()
    return jsonify({'message': 'Doctor updated successfully', 'doctor': doctor.to_dict()}), 200

# (deactivate) doctor
@admin_bp.route('/doctors/<int:doctor_id>', methods=['DELETE'])
def toggle_doctor_status(doctor_id):
    doctor = DoctorProfile.query.get(doctor_id)
    if not doctor:
        return jsonify({'message': 'Doctor not found'}), 404

    user = doctor.user
    user.is_active = not user.is_active  
    status = 'activated' if user.is_active else 'deactivated'
    db.session.commit()
    return jsonify({'message': f'Doctor {status} successfully'}), 200

# Patient management
@admin_bp.route('/patients', methods=['GET'])
def get_patients():
    patients = PatientProfile.query.all()
    result = []
    for patient in patients:
        result.append(patient.to_dict())
    return jsonify(result), 200

# (deactivate) patient
@admin_bp.route('/patients/<int:patient_id>', methods=['DELETE'])
def toggle_patient_status(patient_id):
    patient = PatientProfile.query.get(patient_id)
    if not patient:
        return jsonify({'message': 'Patient not found'}), 404

    user = patient.user
    user.is_active = not user.is_active  
    status = 'activated' if user.is_active else 'deactivated'
    db.session.commit()
    return jsonify({'message': f'Patient {status} successfully'}), 200

# Appointment management
@admin_bp.route('/appointments', methods=['GET'])
def get_appointments():
    appointments = Appointment.query.all()
    result = []
    for appt in appointments:
        result.append(appt.to_dict())
    return jsonify(result), 200

# Update appointment status/notes
@admin_bp.route('/appointments/<int:appt_id>', methods=['PUT'])
def update_appointment(appt_id):
    appt = Appointment.query.get(appt_id)
    if not appt:
        return jsonify({'message': 'Appointment not found'}), 404

    data = request.get_json()
    appt.status = data.get('status', appt.status)
    appt.notes = data.get('notes', appt.notes)
    db.session.commit()
    return jsonify({'message': 'Appointment updated successfully', 'appointment': appt.to_dict()}), 200

# Department management
@admin_bp.route('/departments', methods=['GET'])
def get_departments():
    departments = Department.query.all()
    result = [{'id': d.id, 'name': d.name, 'description': d.description} for d in departments]
    return jsonify(result), 200

# Add new department
@admin_bp.route('/departments', methods=['POST'])
def create_department():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description', '')

    if Department.query.filter_by(name=name).first():
        return jsonify({'message': 'Department name already exists'}), 400

    department = Department(name=name, description=description)
    db.session.add(department)
    db.session.commit()
    return jsonify({'message': 'Department created successfully', 'department': {'id': department.id, 'name': department.name, 'description': department.description}}), 201

# Update department
@admin_bp.route('/departments/<int:dept_id>', methods=['PUT'])
def update_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({'message': 'Department not found'}), 404

    data = request.get_json()
    department.name = data.get('name', department.name)
    department.description = data.get('description', department.description)
    db.session.commit()
    return jsonify({'message': 'Department updated successfully', 'department': {'id': department.id, 'name': department.name, 'description': department.description}}), 200

# Delete department
@admin_bp.route('/departments/<int:dept_id>', methods=['DELETE'])
def delete_department(dept_id):
    department = Department.query.get(dept_id)
    if not department:
        return jsonify({'message': 'Department not found'}), 404

    # Check if department has doctors
    if department.doctors:
        return jsonify({'message': 'Cannot delete department with assigned doctors'}), 400

    db.session.delete(department)
    db.session.commit()
    return jsonify({'message': 'Department deleted successfully'}), 200

