// Load doctor dashboard
let doctorAvailabilityState = [];
async function loadDoctorDashboard() {
    try {
        const response = await axios.get('/api/doctor/dashboard');
        const data = response.data;

        content.innerHTML = `
            <div class="d-flex">
                <div class="flex-grow-1">
                    <h2>Doctor Dashboard</h2>
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h5 class="card-title">Upcoming Appointments</h5>
                                    <p class="card-text display-4">${data.total_upcoming}</p>
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
        const response = await axios.get('/api/doctor/dashboard');
        const appointments = response.data.upcoming_appointments;

        let html = '<h3>Upcoming Appointments</h3><table class="table"><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            html += `<tr>
                <td>${appt.patient_name}</td>
                <td>${appt.date}</td>
                <td>${appt.time}</td>
                <td>${appt.status}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="updateAppointmentStatus(${appt.id}, 'COMPLETED')">Complete</button>
                    <button class="btn btn-sm btn-warning" onclick="updateAppointmentStatus(${appt.id}, 'CANCELLED')">Cancel</button>
                    <button class="btn btn-sm btn-info" onclick="addTreatmentNotes(${appt.id})">Add Notes</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadDoctorDashboard()">Back</button>';

        document.getElementById('doctorContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load appointments');
    }
}

// Update appointment status
async function updateAppointmentStatus(id, status, notes = null) {
    const data = {};
    if (status) data.status = status;
    if (notes) data.notes = notes;

    try {
        await axios.put(`/api/doctor/appointments/${id}`, data);
        alert('Appointment updated');
        viewUpcomingAppointments();
    } catch (error) {
        alert('Failed to update appointment');
    }
}

// Add treatment notes (placeholder)
function addTreatmentNotes(apptId) {
    const notes = prompt('Enter treatment notes:');
    if (notes) {
        updateAppointmentStatus(apptId, null, notes);
    }
}

// View assigned patients
async function viewAssignedPatients() {
    try {
        const response = await axios.get('/api/doctor/patients');
        const patients = response.data;

        let html = '<h3>Assigned Patients</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead><tbody>';
        patients.forEach(patient => {
            html += `<tr>
                <td>${patient.username}</td>
                <td>${patient.email}</td>
                <td>${patient.phone || ''}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewPatientHistory(${patient.id})">View History</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadDoctorDashboard()">Back</button>';

        document.getElementById('doctorContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load patients');
    }
}

// View patient history (placeholder)
function viewPatientHistory(patientId) {
    alert('Patient medical history feature coming soon');
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
async function handleUpdateProfile(e) {
    e.preventDefault();
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

// Update availability 
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