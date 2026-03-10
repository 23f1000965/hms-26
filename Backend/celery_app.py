from celery import Celery
from celery.schedules import crontab
from app.app import create_app

flask_app = create_app()

celery = Celery(
    'hms',
    broker=flask_app.config['CELERY_BROKER_URL'],
    backend=flask_app.config['CELERY_RESULT_BACKEND']
)

celery.conf.update(
    timezone=flask_app.config.get('CELERY_TIMEZONE', 'Asia/Kolkata'),
    broker_connection_retry_on_startup=flask_app.config.get('BROKER_CONNECTION_RETRY_ON_STARTUP', True),
)

celery.conf.beat_schedule = {
    'daily-reminder-job': {
        'task': 'tasks.daily_reminder_job',
        'schedule': crontab(hour=8, minute=0),
    },
    'monthly-report-job': {
        'task': 'tasks.monthly_report_job',
        'schedule': crontab(hour=9, minute=0, day_of_month='1'),
    },
}


class FlaskContextTask(celery.Task):
    def __call__(self, *args, **kwargs):
        with flask_app.app_context():
            return self.run(*args, **kwargs)


celery.Task = FlaskContextTask

import tasks