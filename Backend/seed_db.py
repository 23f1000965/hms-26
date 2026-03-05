from app.app import create_app
from app.models import db, User, Department
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

        print("created successfully.")

if __name__ == '__main__':
    create_database()