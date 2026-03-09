// Doctor Dashboard Functions

let doctorAvailabilityState = [];
let doctorDashboardAppointments = [];
let doctorAssignedPatients = [];

async function refreshDoctorDashboardData() {
    const [dashboardResponse, patientsResponse] = await Promise.all([
        axios.get('/api/doctor/dashboard'),
        axios.get('/api/doctor/patients')
    ]);

    doctorDashboardAppointments = dashboardResponse.data.upcoming_appointments || [];
    doctorAssignedPatients = patientsResponse.data || [];

    return dashboardResponse.data;
}

// Load doctor dashboard
async function loadDoctorDashboard() {
    try {
        const data = await refreshDoctorDashboardData();

        const today = new Date().toISOString().slice(0, 10);
        const bookedAppointments = doctorDashboardAppointments.filter(appt => appt.status === 'BOOKED');
        const todaysSchedule = bookedAppointments.filter(appt => appt.date === today).length;
        const totalPatients = doctorAssignedPatients.length;
        const completedToday = doctorDashboardAppointments.filter(
            appt => appt.status === 'COMPLETED' && appt.date === today
        ).length;

        content.innerHTML = `
            <div class="d-flex">
                <div class="flex-grow-1">
                    <h2>Doctor Dashboard</h2>
                    <div class="row mb-4">
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body" role="button" onclick="viewUpcomingAppointments()">
                                    <h5 class="card-title">Upcoming Appointments</h5>
                                    <p class="card-text display-4">${bookedAppointments.length}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body" role="button" onclick="viewUpcomingAppointments()">
                                    <h5 class="card-title">Today's Schedule</h5>
                                    <p class="card-text display-4">${todaysSchedule}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body" role="button" onclick="viewAssignedPatients()">
                                    <h5 class="card-title">Total Patients</h5>
                                    <p class="card-text display-4">${totalPatients}</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body" role="button" onclick="viewAssignedPatients()">
                                    <h5 class="card-title">Completed Today</h5>
                                    <p class="card-text display-4">${completedToday}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <button class="btn btn-primary me-2" onclick="viewUpcomingAppointments()">View Appointments</button>
                        <button class="btn btn-secondary me-2" onclick="viewAssignedPatients()">View Patients</button>
                        <button class="btn btn-info me-2" onclick="viewProfile()">My Profile</button>
                        <button class="btn btn-warning me-2" onclick="updateAvailability()">Update Availability</button>
                        <button class="btn btn-danger" onclick="logout()">Logout</button>
                    </div>
                    <div id="doctorContent"></div>
                </div>
                <div class="ms-3">
                    <button class="btn btn-outline-primary position-relative" onclick="showNotifications()">
                        <i class="fas fa-bell"></i>
                        <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" id="notificationBadge" style="display: none;">0</span>
                    </button>
                </div>
            </div>
        `;

        loadNotificationsBadge();
        viewUpcomingAppointments();
    } catch (error) {
        alert('Failed to load dashboard');
    }
}

// Load notifications badge
async function loadNotificationsBadge() {
    try {
        const response = await axios.get('/api/doctor/notifications');
        const notifications = response.data;
        const badge = document.getElementById('notificationBadge');
        if (notifications.length > 0) {
            badge.textContent = notifications.length;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load notifications');
    }
}

// Show notifications sidebar
async function showNotifications() {
    try {
        const response = await axios.get('/api/doctor/notifications');
        const notifications = response.data;

        let html = '<h4>Notifications</h4><ul class="list-group">';
        notifications.forEach(notif => {
            html += `<li class="list-group-item">${notif.message} <small class="text-muted">${notif.date}</small></li>`;
        });
        html += '</ul>';

        // Simple modal or sidebar
        const modal = document.createElement('div');
        modal.className = 'modal fade show';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Notifications</h5>
                        <button type="button" class="btn-close" onclick="this.closest('.modal').remove()"></button>
                    </div>
                    <div class="modal-body">${html}</div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } catch (error) {
        alert('Failed to load notifications');
    }
}

// View upcoming appointments
async function viewUpcomingAppointments() {
    try {
        if (!doctorDashboardAppointments.length) {
            await refreshDoctorDashboardData();
        }

        const appointments = doctorDashboardAppointments.filter(appt => appt.status === 'BOOKED');

        let html = '<h3>Upcoming Appointments</h3><table class="table"><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            html += `<tr>
                <td>${appt.patient_name}</td>
                <td>${appt.date}</td>
                <td>${appt.time}</td>
                <td>${appt.status}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="openCompleteModal(${appt.id}, '${appt.patient_name.replace(/'/g, "\\'")}')">Complete</button>
                    <button class="btn btn-sm btn-warning" onclick="cancelAppointmentByDoctor(${appt.id})">Cancel</button>
                </td>
            </tr>`;
        });
        if (!appointments.length) {
            html += '<tr><td colspan="5" class="text-muted">No booked appointments</td></tr>';
        }
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadDoctorDashboard()">Back</button>';

        document.getElementById('doctorContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load appointments');
    }
}

// Update appointment status
async function updateAppointmentStatus(id, status, treatment = null) {
    const data = {};
    if (status) data.status = status;
    if (treatment) data.treatment = treatment;

    try {
        await axios.put(`/api/doctor/appointments/${id}`, data);
        alert('Appointment updated');
        await refreshDoctorDashboardData();
        viewUpcomingAppointments();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to update appointment');
    }
}

async function cancelAppointmentByDoctor(appointmentId) {
    await updateAppointmentStatus(appointmentId, 'CANCELLED');
}

function addMedicineField() {
    const container = document.getElementById('doctorMedicinesContainer');
    if (!container) {
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'row g-2 mb-2 medicine-row';
    wrapper.innerHTML = `
        <div class="col-md-4">
            <input type="text" class="form-control medicine-name" placeholder="Medicine name">
        </div>
        <div class="col-md-2">
            <select class="form-select medicine-morning">
                <option value="0" selected>0</option>
                <option value="1">1</option>
            </select>
        </div>
        <div class="col-md-2">
            <select class="form-select medicine-afternoon">
                <option value="0" selected>0</option>
                <option value="1">1</option>
            </select>
        </div>
        <div class="col-md-2">
            <select class="form-select medicine-night">
                <option value="0" selected>0</option>
                <option value="1">1</option>
            </select>
        </div>
        <div class="col-md-2">
            <button type="button" class="btn btn-outline-danger w-100" onclick="this.closest('.medicine-row').remove()">Remove</button>
        </div>
    `;
    container.appendChild(wrapper);
}

function openCompleteModal(apptId, patientName) {
    const existingModal = document.getElementById('completeAppointmentModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div class="modal fade" id="completeAppointmentModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Update Patient History</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p class="mb-1"><strong>Patient Name:</strong> ${patientName}</p>
                        <form id="completeAppointmentForm">
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Visit Type</label>
                                    <input type="text" class="form-control" id="visitType" value="In-person" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label">Test Done</label>
                                    <input type="text" class="form-control" id="testsDone" placeholder="e.g. ECG">
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Diagnosis</label>
                                <input type="text" class="form-control" id="diagnosis" placeholder="Diagnosis" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Prescription</label>
                                <input type="text" class="form-control" id="prescription" placeholder="Prescription details">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Medicines</label>
                                <div class="row g-2 mb-2">
                                    <div class="col-md-4"><small class="text-muted">Name</small></div>
                                    <div class="col-md-2"><small class="text-muted">Morning</small></div>
                                    <div class="col-md-2"><small class="text-muted">Afternoon</small></div>
                                    <div class="col-md-2"><small class="text-muted">Night</small></div>
                                    <div class="col-md-2"></div>
                                </div>
                                <div id="doctorMedicinesContainer"></div>
                                <button type="button" class="btn btn-outline-primary btn-sm" onclick="addMedicineField()">Add Medicine</button>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-success" id="saveCompleteAppointmentBtn">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContainer.firstElementChild);
    addMedicineField();

    const modalElement = document.getElementById('completeAppointmentModal');
    const modal = new bootstrap.Modal(modalElement);

    document.getElementById('saveCompleteAppointmentBtn').addEventListener('click', async () => {
        const medicines = Array.from(document.querySelectorAll('.medicine-row'))
            .map(row => ({
                name: row.querySelector('.medicine-name')?.value.trim() || '',
                morning: row.querySelector('.medicine-morning')?.value.trim() || '',
                afternoon: row.querySelector('.medicine-afternoon')?.value.trim() || '',
                night: row.querySelector('.medicine-night')?.value.trim() || ''
            }))
            .filter(item => item.name.length > 0);

        const treatment = {
            visit_type: document.getElementById('visitType').value.trim(),
            tests_done: document.getElementById('testsDone').value.trim(),
            diagnosis: document.getElementById('diagnosis').value.trim(),
            prescription: document.getElementById('prescription').value.trim(),
            medicines
        };

        if (!treatment.visit_type || !treatment.diagnosis) {
            alert('Visit Type and Diagnosis are required');
            return;
        }

        await updateAppointmentStatus(apptId, 'COMPLETED', treatment);
        modal.hide();
        modalElement.remove();
    });

    modal.show();
}

async function openTreatmentViewModal(apptId) {
    try {
        const response = await axios.get(`/api/doctor/appointments/${apptId}/treatment`);
        const data = response.data;

        const existingModal = document.getElementById('viewTreatmentModal');
        if (existingModal) {
            existingModal.remove();
        }

        const medicinesRows = (data.medicines || []).map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${item.name || '-'}</td>
                <td>${item.morning || '-'}</td>
                <td>${item.afternoon || '-'}</td>
                <td>${item.night || '-'}</td>
            </tr>
        `).join('');

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div class="modal fade" id="viewTreatmentModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Patient History Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>Patient:</strong> ${data.patient_name}</p>
                            <p><strong>Department:</strong> ${data.department}</p>
                            <p><strong>Visit Type:</strong> ${data.visit_type || 'In-person'}</p>
                            <p><strong>Test Done:</strong> ${data.tests_done || '-'}</p>
                            <p><strong>Diagnosis:</strong> ${data.diagnosis || '-'}</p>
                            <p><strong>Prescription:</strong> ${data.prescription || '-'}</p>
                            <p class="mb-1"><strong>Medicines:</strong></p>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Medicine</th>
                                            <th>Morning</th>
                                            <th>Afternoon</th>
                                            <th>Night</th>
                                        </tr>
                                    </thead>
                                    <tbody>${medicinesRows || '<tr><td colspan="5" class="text-muted">No medicines</td></tr>'}</tbody>
                                </table>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer.firstElementChild);
        const modalElement = document.getElementById('viewTreatmentModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to load treatment details');
    }
}

// View assigned patients
async function viewAssignedPatients() {
    try {
        if (!doctorDashboardAppointments.length) {
            await refreshDoctorDashboardData();
        }

        const records = doctorDashboardAppointments.filter(appt => appt.status !== 'BOOKED');

        let html = '<h3>Assigned Patients</h3><table class="table"><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        records.forEach(appt => {
            html += `<tr>
                <td>${appt.patient_name}</td>
                <td>${appt.date}</td>
                <td>${appt.time}</td>
                <td>${appt.status}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="openAssignedViewModal(${appt.id})">View</button>
                </td>
            </tr>`;
        });
        if (!records.length) {
            html += '<tr><td colspan="5" class="text-muted">No completed or cancelled records</td></tr>';
        }
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadDoctorDashboard()">Back</button>';

        document.getElementById('doctorContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load patients');
    }
}

async function openAssignedViewModal(apptId) {
    const appointment = doctorDashboardAppointments.find(item => item.id === apptId);
    if (!appointment) {
        alert('Appointment not found');
        return;
    }

    if (appointment.status === 'COMPLETED') {
        await openTreatmentViewModal(apptId);
        return;
    }

    if (appointment.status !== 'CANCELLED') {
        alert('Only completed/cancelled records can be viewed here');
        return;
    }

    const existingModal = document.getElementById('assignedViewModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div class="modal fade" id="assignedViewModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Appointment Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Patient:</strong> ${appointment.patient_name}</p>
                        <p><strong>Date:</strong> ${appointment.date}</p>
                        <p><strong>Time:</strong> ${appointment.time}</p>
                        <p><strong>Status:</strong> ${appointment.status}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContainer.firstElementChild);
    const modalElement = document.getElementById('assignedViewModal');
    const modal = new bootstrap.Modal(modalElement);

    modal.show();
}

// View profile
async function viewProfile() {
    try {
        const response = await axios.get('/api/doctor/profile');
        const profile = response.data;

        const existingModal = document.getElementById('doctorProfileModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div class="modal fade" id="doctorProfileModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">My Profile</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="profileForm">
                                <div class="mb-3">
                                    <label class="form-label">Username</label>
                                    <input type="text" class="form-control" id="profileUsername" value="${profile.username}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="profileEmail" value="${profile.email}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Department</label>
                                    <input type="text" class="form-control" value="${profile.department}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">License Number</label>
                                    <input type="text" class="form-control" id="profileLicense" value="${profile.license_number || ''}">
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-success" id="saveProfileBtn">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer.firstElementChild);
        const modalElement = document.getElementById('doctorProfileModal');
        const modal = new bootstrap.Modal(modalElement);

        document.getElementById('saveProfileBtn').addEventListener('click', handleUpdateProfile);
        modal.show();
    } catch (error) {
        alert('Failed to load profile');
    }
}

// Handle update profile
async function handleUpdateProfile() {
    const data = {
        username: document.getElementById('profileUsername').value,
        email: document.getElementById('profileEmail').value,
        license_number: document.getElementById('profileLicense').value
    };

    try {
        await axios.put('/api/doctor/profile', data);
        alert('Profile updated');
        const modalElement = document.getElementById('doctorProfileModal');
        if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            modalElement.remove();
        }
        loadDoctorDashboard();
    } catch (error) {
        alert('Failed to update profile');
    }
}

// Load 7-day availability
async function updateAvailability() {
    try {
        const response = await axios.get('/api/doctor/availability');
        doctorAvailabilityState = response.data.availability || [];
        renderAvailabilityScheduler();
    } catch (error) {
        alert('Failed to load availability');
    }
}

function renderAvailabilityScheduler() {
    const rows = doctorAvailabilityState.map((day, index) => {
        const morningClass = day.morning.is_available ? 'btn-outline-success text-success' : 'btn-outline-danger text-danger';
        const eveningClass = day.evening.is_available ? 'btn-outline-success text-success' : 'btn-outline-danger text-danger';

        return `
            <tr>
                <td><button class="btn btn-outline-secondary" disabled>${formatAvailabilityDate(day.date)}</button></td>
                <td>
                    <button class="btn ${morningClass}" onclick="toggleAvailabilitySlot(${index}, 'morning')">
                        10:00 AM - 1:00 PM
                    </button>
                </td>
                <td>
                    <button class="btn ${eveningClass}" onclick="toggleAvailabilitySlot(${index}, 'evening')">
                        3:00 PM - 7:00 PM
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('doctorContent').innerHTML = `
        <div class="card">
            <div class="card-body">
                <h3>Doctor Availability (Next 7 Days)</h3>
                <p class="text-muted mb-3">Click any slot to mark it available .</p>
                <table class="table table-borderless align-middle">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Morning</th>
                            <th>Evening</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="mt-3">
                    <button class="btn btn-success me-2" onclick="saveAvailabilitySchedule()">Save</button>
                    <button class="btn btn-secondary" onclick="loadDoctorDashboard()">Back</button>
                </div>
            </div>
        </div>
    `;
}

function toggleAvailabilitySlot(index, slotKey) {
    if (!doctorAvailabilityState[index]) {
        return;
    }

    doctorAvailabilityState[index][slotKey].is_available = !doctorAvailabilityState[index][slotKey].is_available;
    renderAvailabilityScheduler();
}

async function saveAvailabilitySchedule() {
    const payload = {
        availability: doctorAvailabilityState.map(day => ({
            date: day.date,
            morning_available: day.morning.is_available,
            evening_available: day.evening.is_available
        }))
    };

    try {
        await axios.put('/api/doctor/availability', payload);
        alert('Availability saved successfully');
        loadDoctorDashboard();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to save availability');
    }
}

function formatAvailabilityDate(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) {
        return dateText;
    }
    return date.toLocaleDateString('en-GB');
}