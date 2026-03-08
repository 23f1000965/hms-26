from flask import Flask, send_from_directory
from flask_caching import Cache
from flask_jwt_extended import JWTManager
from .models import db
import os
from flask_cors import CORS

jwt = JWTManager()
cache = Cache()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'hospital-management-system-secret-key-2026' 

    app.config['JWT_SECRET_KEY'] = 'super-secret-key-for-hms-jwt-authentication-2026'
    app.config['JWT_TOKEN_LOCATION'] = ['headers']  
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'

    db.init_app(app)
    jwt.init_app(app)
    cache.init_app(app)
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