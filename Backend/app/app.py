from flask import Flask
from flask_caching import Cache
from flask_jwt_extended import JWTManager
from .models import db

jwt = JWTManager()
cache = Cache()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hospital.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = 'hms-2026' 

    db.init_app(app)
    jwt.init_app(app)
    cache.init_app(app)

    return app