from app.app import create_app
from app.models import DoctorProfile, db, User, Department, PatientProfile
from datetime import date
try:
    from werkzeug.security import generate_password_hash
except ImportError:
    from werkzeug.utils import secure_filename
    def generate_password_hash(password):
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest()

#creating database and adding default admin and departments
def create_database():
    app = create_app()
    with app.app_context():
        # Create all tables
        db.create_all()

        # Check if admin exists
        admin = User.query.filter_by(role='ADMIN').first()
        if not admin:
            # Create default admin
            admin_user = User(
                username='admin',
                email='admin@hospital.com',
                password_hash=generate_password_hash('admin'), 
                role='ADMIN'
            )
            db.session.add(admin_user)
            db.session.commit()
            print("Default admin user created")
        else:
            print("Admin  already exists.")

        # Add default departments if not exist
        if Department.query.count() == 0:
            departments = [
                {'name': 'Cardiology', 'description': 'Heart and cardiovascular diseases'},
                {'name': 'Neurology', 'description': 'Brain and nervous system'},
                {'name': 'Orthopedics', 'description': 'Bones and joints'},
                {'name': 'Pediatrics', 'description': 'Child healthcare'},
                {'name': 'Dermatology', 'description': 'Skin conditions'}
            ]
            for dept_data in departments:
                dept = Department(**dept_data)
                db.session.add(dept)
            db.session.commit()
            print("Default departments created")

        # Add default patient user and profile 
        if User.query.filter_by(role='PATIENT').count() == 0:
            patient_user = User(
                username='rohit',
                email='rohit@hospital.com',
                password_hash=generate_password_hash('123'),
                role='PATIENT'
            )
            db.session.add(patient_user)
            db.session.commit()

            patient_profile = PatientProfile(
                user_id=patient_user.id,
                date_of_birth=date(2000, 1, 1),
                phone='1234567890',
                address='123 Main St, City',
                emergency_contact='John Doe - 9876543210'
            )
            db.session.add(patient_profile)
            db.session.commit()
            print("Default patient user and profile created")
        else:
            print("Patient already exists.")

        # Add default doctor user and profile 
        if User.query.filter_by(role='DOCTOR').count() == 0:
            doctor_user = User(
                username='Dr rahul',
                email='rahul@hospital.com',
                password_hash=generate_password_hash('123'),
                role='DOCTOR'
            )
            db.session.add(doctor_user)
            db.session.commit()

            cardiology = Department.query.filter_by(name='Cardiology').first()
            selected_department = cardiology or Department.query.first()

            if not selected_department:
                raise RuntimeError('No department found. Please seed departments first.')

            base_license = 'DOC123456'
            license_number = base_license
            suffix = 1
            while DoctorProfile.query.filter_by(license_number=license_number).first():
                suffix += 1
                license_number = f'{base_license}-{suffix}'

            doctor_profile = DoctorProfile(
                user_id=doctor_user.id,
                department_id=selected_department.id,
                license_number=license_number
            )
            db.session.add(doctor_profile)
            db.session.commit()
            print("Default doctor user and profile created")
        else:
            print("Doctor already exists.")

        print("created successfully.")

if __name__ == '__main__':
    create_database()