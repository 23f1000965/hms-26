from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from ..models import db, User, DoctorProfile, PatientProfile
from datetime import timedelta, datetime

auth_bp = Blueprint('auth', __name__)

# registration route
@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'PATIENT')  # hmesa patient ke liye default rhega jo register krega 
    date_of_birth = data.get('date_of_birth')
    phone = data.get('phone')
    address = data.get('address')
    emergency_contact = data.get('emergency_contact')

    if role not in ['PATIENT']:
        return jsonify({'message': 'Only patients can self-register'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'message': 'Username already exists'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Email already exists'}), 400

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        role=role
    )
    db.session.add(user)
    db.session.commit()

    # patient profile ban rha hai
    patient = PatientProfile(
        user_id=user.id,
        date_of_birth=datetime.fromisoformat(date_of_birth) if date_of_birth else None,
        phone=phone,
        address=address,
        emergency_contact=emergency_contact
    )
    db.session.add(patient)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201

# login route
@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'message': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'message': 'Account is deactivated'}), 401
   # JWT token generate ho rha hai login ke time 
    access_token = create_access_token(identity=str(user.id), expires_delta=timedelta(hours=1))
    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        }
    }), 200

# profile route
@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404

    profile_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role
    }

    if user.role == 'DOCTOR':
        doctor = DoctorProfile.query.filter_by(user_id=user.id).first()
        if doctor:
            profile_data['department'] = doctor.department.name
    elif user.role == 'PATIENT':
        patient = PatientProfile.query.filter_by(user_id=user.id).first()
        if patient:
            profile_data['phone'] = patient.phone
            profile_data['address'] = patient.address

    return jsonify(profile_data), 200