from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.Enum('ADMIN', 'DOCTOR', 'PATIENT', name='user_role'), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    doctor_profile = db.relationship('DoctorProfile', backref='user', uselist=False, cascade='all, delete-orphan')
    patient_profile = db.relationship('PatientProfile', backref='user', uselist=False, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'

class DoctorProfile(db.Model):
    __tablename__ = 'doctor_profile'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey('department.id'), nullable=False)
    license_number = db.Column(db.String(50), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    appointments = db.relationship('Appointment', backref='doctor', lazy=True)

    def __repr__(self):
        return f'<DoctorProfile {self.user.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username,
            'email': self.user.email,
            'department': self.department.name,
            'department_id': self.department_id,
            'license_number': self.license_number,
            'is_active': self.user.is_active
        }

class PatientProfile(db.Model):
    __tablename__ = 'patient_profile'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date_of_birth = db.Column(db.Date)
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    emergency_contact = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    appointments = db.relationship('Appointment', backref='patient', lazy=True)

    def __repr__(self):
        return f'<PatientProfile {self.user.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username,
            'email': self.user.email,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'phone': self.phone,
            'address': self.address,
            'emergency_contact': self.emergency_contact,
            'is_active': self.user.is_active
        }

class Department(db.Model):
    __tablename__ = 'department'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    doctors = db.relationship('DoctorProfile', backref='department', lazy=True)

    def __repr__(self):
        return f'<Department {self.name}>'

class Appointment(db.Model):
    __tablename__ = 'appointment'

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor_profile.id'), nullable=False)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient_profile.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time, nullable=False)
    status = db.Column(db.Enum('BOOKED', 'COMPLETED', 'CANCELLED', name='appointment_status'), default='BOOKED')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint
    __table_args__ = (
        db.UniqueConstraint('doctor_id', 'date', 'time', name='unique_doctor_datetime'),
    )

    # Relationships
    treatments = db.relationship('Treatment', backref='appointment', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Appointment {self.id} - {self.status}>'

    def to_dict(self):
        return {
            'id': self.id,
            'doctor': self.doctor.user.username,
            'patient': self.patient.user.username,
            'date': self.date.isoformat(),
            'time': self.time.isoformat(),
            'status': self.status,
            'created_at': self.created_at.isoformat()
        }

class Treatment(db.Model):
    __tablename__ = 'treatment'

    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointment.id'), nullable=False)
    visit_type = db.Column(db.String(50), default='In-person', nullable=False)
    tests_done = db.Column(db.Text)
    diagnosis = db.Column(db.Text, nullable=False)
    prescription = db.Column(db.Text)
    medicines = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Treatment {self.id}>'

# Indexes for performance
db.Index('idx_user_email', User.email)
db.Index('idx_user_role', User.role)
db.Index('idx_appointment_date', Appointment.date)
db.Index('idx_appointment_status', Appointment.status)
db.Index('idx_appointment_doctor', Appointment.doctor_id)
db.Index('idx_appointment_patient', Appointment.patient_id)
db.Index('idx_doctor_profile_department', DoctorProfile.department_id)
db.Index('idx_doctor_profile_user', DoctorProfile.user_id)
db.Index('idx_patient_profile_user', PatientProfile.user_id)

class DoctorAvailability(db.Model):
    __tablename__ = 'doctor_availability'

    id = db.Column(db.Integer, primary_key=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey('doctor_profile.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint per doctor per date
    __table_args__ = (
        db.UniqueConstraint('doctor_id', 'date', 'start_time', 'end_time', name='unique_doctor_date_time_range'),
    )

    # Relationships
    doctor = db.relationship('DoctorProfile', backref='availabilities')

    def __repr__(self):
        return f'<DoctorAvailability {self.doctor.user.username} - {self.date}>'

    def to_dict(self):
        return {
            'id': self.id,
            'doctor_id': self.doctor_id,
            'date': self.date.isoformat(),
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'is_available': self.is_available
        }