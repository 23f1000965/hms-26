from datetime import datetime
import csv
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo
from celery_app import celery, flask_app
from app.models import Appointment, DoctorProfile, PatientProfile, Treatment


def _ensure_output_dir(folder_name: str) -> str:
    root_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(root_dir, 'generated', folder_name)
    os.makedirs(output_dir, exist_ok=True)
    return output_dir


def _send_email_via_smtp(recipient: str, subject: str, html_body: str):
    sender = flask_app.config.get('MAIL_DEFAULT_SENDER', 'support@hms.local')
    host = flask_app.config.get('MAIL_SERVER', 'localhost')
    port = int(flask_app.config.get('MAIL_PORT', 1025))

    message = MIMEMultipart('alternative')
    message['Subject'] = subject
    message['From'] = sender
    message['To'] = recipient
    message.attach(MIMEText(html_body, 'html'))

    with smtplib.SMTP(host, port, timeout=15) as smtp:
        smtp.sendmail(sender, [recipient], message.as_string())


@celery.task(name='tasks.daily_reminder_job')
def daily_reminder_job():
    tz_name = flask_app.config.get('CELERY_TIMEZONE', 'Asia/Kolkata')
    today = datetime.now(ZoneInfo(tz_name)).date()
    appointments = Appointment.query.filter(
        Appointment.date == today,
        Appointment.status == 'BOOKED'
    ).all()

    reminders = []
    sent_count = 0
    failed_count = 0

    for appt in appointments:
        patient_name = appt.patient.user.username
        patient_email = appt.patient.user.email
        doctor_name = appt.doctor.user.username
        department = appt.doctor.department.name
        date_text = appt.date.isoformat()
        time_text = appt.time.strftime('%I:%M %p')

        subject = f'HMS Reminder: Appointment Today at {time_text}'
        html_body = f"""
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 20px auto;'>
            <h2>Appointment Reminder</h2>
            <p>Hi {patient_name},</p>
            <p>This is a reminder for your appointment scheduled for today.</p>
            <ul>
                <li><strong>Doctor:</strong>  {doctor_name}</li>
                <li><strong>Department:</strong> {department}</li>
                <li><strong>Date:</strong> {date_text}</li>
                <li><strong>Time:</strong> {time_text}</li>
            </ul>
            <p>Please arrive 10 minutes early.</p>
            <p>Regards,<br/>Hospital Management System</p>
        </div>
        """

        try:
            _send_email_via_smtp(patient_email, subject, html_body)
            sent_count += 1
            status = 'SENT'
            error_message = None
        except Exception as exc:
            failed_count += 1
            status = 'FAILED'
            error_message = str(exc)

        reminders.append({
            'patient': patient_name,
            'patient_email': patient_email,
            'doctor': doctor_name,
            'date': date_text,
            'time': appt.time.isoformat(),
            'channel': 'EMAIL',
            'status': status,
            'error': error_message
        })

    return {
        'message': 'Daily reminder job executed',
        'date': today.isoformat(),
        'scheduled_count': len(appointments),
        'sent_count': sent_count,
        'failed_count': failed_count,
        'total_reminders': len(reminders),
        'reminders': reminders
    }


@celery.task(name='tasks.monthly_report_job')
def monthly_report_job():
    now = datetime.utcnow()
    year, month = now.year, now.month

    doctors = DoctorProfile.query.all()
    sent_count = 0
    failed_count = 0
    reports = []

    for doctor in doctors:
        doctor_appts = Appointment.query.filter(
            Appointment.doctor_id == doctor.id,
            Appointment.date >= datetime(year, month, 1).date(),
            Appointment.date <= now.date()
        ).all()

        completed = [a for a in doctor_appts if a.status == 'COMPLETED']
        cancelled = [a for a in doctor_appts if a.status == 'CANCELLED']
        booked = [a for a in doctor_appts if a.status == 'BOOKED']

        diagnosis_summary = {}
        appointment_rows = []
        for appt in completed:
            treatment = Treatment.query.filter_by(appointment_id=appt.id).first()
            diagnosis = (treatment.diagnosis if treatment else 'N/A') or 'N/A'
            diagnosis_summary[diagnosis] = diagnosis_summary.get(diagnosis, 0) + 1

        for appt in doctor_appts:
            treatment = Treatment.query.filter_by(appointment_id=appt.id).first()
            diagnosis = (treatment.diagnosis if treatment else 'N/A') or 'N/A'
            prescription = (treatment.prescription if treatment else 'N/A') or 'N/A'
            appointment_rows.append(f"""
                <tr>
                    <td>{appt.id}</td>
                    <td>{appt.patient.user.username}</td>
                    <td>{appt.date.isoformat()}</td>
                    <td>{appt.time.strftime('%I:%M %p')}</td>
                    <td>{appt.status}</td>
                    <td>{diagnosis}</td>
                    <td>{prescription}</td>
                </tr>
            """)

        html_content = f"""
        <html>
            <head><title>Monthly Report - {doctor.user.username}</title></head>
            <body>
                <h2>Monthly Doctor Report</h2>
                <p><strong>Doctor:</strong> {doctor.user.username}</p>
                <p><strong>Department:</strong> {doctor.department.name}</p>
                <p><strong>Month:</strong> {year}-{month:02d}</p>
                <hr/>
                <p><strong>Total Appointments:</strong> {len(doctor_appts)}</p>
                <p><strong>Booked:</strong> {len(booked)}</p>
                <p><strong>Completed:</strong> {len(completed)}</p>
                <p><strong>Cancelled:</strong> {len(cancelled)}</p>
                <h3>Diagnosis Summary</h3>
                <ul>
                    {''.join([f'<li>{diag}: {count}</li>' for diag, count in diagnosis_summary.items()]) or '<li>No completed diagnosis data</li>'}
                </ul>
                <h3>Appointments Details</h3>
                <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr>
                            <th>Appointment ID</th>
                            <th>Patient</th>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Status</th>
                            <th>Diagnosis</th>
                            <th>Prescription</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join(appointment_rows) or '<tr><td colspan="7">No appointments this month.</td></tr>'}
                    </tbody>
                </table>
            </body>
        </html>
        """

        recipient = doctor.user.email
        subject = f"HMS Monthly Activity Report - {year}-{month:02d}"

        try:
            _send_email_via_smtp(recipient, subject, html_content)
            sent_count += 1
            reports.append({
                'doctor_id': doctor.id,
                'doctor_name': doctor.user.username,
                'doctor_email': recipient,
                'status': 'SENT',
                'error': None,
            })
        except Exception as exc:
            failed_count += 1
            reports.append({
                'doctor_id': doctor.id,
                'doctor_name': doctor.user.username,
                'doctor_email': recipient,
                'status': 'FAILED',
                'error': str(exc),
            })

    return {
        'message': 'Monthly report  job executed',
        'month': f'{year}-{month:02d}',
        'total_doctors': len(doctors),
        'sent_count': sent_count,
        'failed_count': failed_count,
        'reports': reports,
    }


@celery.task(name='tasks.export_patient_history_csv')
def export_patient_history_csv(patient_id: int):
    patient = PatientProfile.query.get(patient_id)
    if not patient:
        return {'message': 'Patient not found'}

    appointments = Appointment.query.filter_by(patient_id=patient.id).order_by(
        Appointment.date.desc(), Appointment.time.desc()
    ).all()

    output_dir = _ensure_output_dir('exports')
    timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    file_name = f"patient_history_{patient.id}_{timestamp}.csv"
    file_path = os.path.join(output_dir, file_name)

    with open(file_path, 'w', newline='', encoding='utf-8') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow([
            'appointment_id', 'doctor_name', 'department', 'date', 'time',
            'status', 'visit_type', 'tests_done', 'diagnosis', 'prescription', 'medicines'
        ])

        for appt in appointments:
            treatment = Treatment.query.filter_by(appointment_id=appt.id).first()
            medicines_text = ''
            if treatment and treatment.medicines:
                try:
                    parsed = json.loads(treatment.medicines)
                    if isinstance(parsed, list):
                        medicines_text = ', '.join([
                            item.get('name', '') if isinstance(item, dict) else str(item)
                            for item in parsed
                        ])
                    else:
                        medicines_text = str(treatment.medicines)
                except Exception:
                    medicines_text = str(treatment.medicines)

            writer.writerow([
                appt.id,
                appt.doctor.user.username,
                appt.doctor.department.name,
                appt.date.isoformat(),
                appt.time.isoformat(),
                appt.status,
                treatment.visit_type if treatment else '',
                treatment.tests_done if treatment else '',
                treatment.diagnosis if treatment else '',
                treatment.prescription if treatment else '',
                medicines_text,
            ])

    return {
        'message': 'Patient history CSV generated',
        'patient_id': patient.id,
        'patient_name': patient.user.username,
        'file_name': file_name,
        'file_path': file_path
    }
