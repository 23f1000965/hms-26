from flask import Flask, send_from_directory
from flask_jwt_extended import JWTManager
from .models import db
import os
from flask_cors import CORS

jwt = JWTManager()


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'hospital-management-system-secret-key-2026' 

    

    # Celery + Redis config
    app.config['CELERY_BROKER_URL'] = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    app.config['CELERY_RESULT_BACKEND'] = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
    app.config['CELERY_TIMEZONE'] = os.getenv('CELERY_TIMEZONE', 'Asia/Kolkata')
    app.config['BROKER_CONNECTION_RETRY_ON_STARTUP'] = True

    # MailHog / SMTP config (used by Celery reminder job)
    app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'localhost')
    app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', '1025'))
    app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'false').lower() == 'true'
    app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL', 'false').lower() == 'true'
    app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'support@hms.local')


    app.config['JWT_SECRET_KEY'] = 'super-secret-key-for-hms-jwt-authentication-2026'
    app.config['JWT_TOKEN_LOCATION'] = ['headers']  
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'

    db.init_app(app)
    jwt.init_app(app)

    CORS(app)  # Enable CORS for all routes

    from .routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    from .routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    from .routes.doctor import doctor_bp
    app.register_blueprint(doctor_bp, url_prefix='/api/doctor')
    from .routes.patient import patient_bp
    app.register_blueprint(patient_bp, url_prefix='/api/patient')

    # frontend serving
    frontend_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'Frontend')
    
    @app.route('/')
    def index():
        return send_from_directory(frontend_dir, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(frontend_dir, path)


    return app