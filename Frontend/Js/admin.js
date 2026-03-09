let adminAppointmentsCache = [];
// Load admin dashboard
async function loadAdminDashboard() {
    try {
        const response = await axios.get('/api/admin/dashboard');
        const stats = response.data;

        content.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h2 class="mb-0">Admin Dashboard</h2>
                <div class="input-group" style="max-width: 430px; min-width: 280px;">
                    <input type="text" class="form-control" id="adminGlobalSearchInput" placeholder="Search doctor/patient (name, specialization, id, contact)" onkeydown="handleAdminSearchEnter(event)">
                    <button class="btn btn-outline-primary" onclick="runAdminGlobalSearch()">Search</button>
                </div>
            </div>
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card text-center" role="button" onclick="loadDoctors()" style="cursor:pointer;">
                        <div class="card-body">
                            <h5 class="card-title">Total Doctors</h5>
                            <p class="card-text display-4">${stats.total_doctors}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center" role="button" onclick="loadPatients()" style="cursor:pointer;">
                        <div class="card-body">
                            <h5 class="card-title">Total Patients</h5>
                            <p class="card-text display-4">${stats.total_patients}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center" role="button" onclick="loadAppointments()" style="cursor:pointer;">
                        <div class="card-body">
                            <h5 class="card-title">Total Appointments</h5>
                            <p class="card-text display-4">${stats.total_appointments}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div>
                    <button class="btn btn-secondary me-2" onclick="loadDoctors()">Manage Doctors</button>
                    <button class="btn btn-info me-2" onclick="loadPatients()">Manage Patients</button>
                    <button class="btn btn-warning me-2" onclick="loadAppointments()">Manage Appointments</button>
                    <button class="btn btn-success me-2" onclick="loadDepartments()">Manage Departments</button>
                    <button class="btn btn-danger" onclick="logout()">Logout</button>
                </div>
            </div>
            <div id="adminContent"></div>
        `;
    } catch (error) {
        alert('Failed to load dashboard');
    }
}

function handleAdminSearchEnter(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        runAdminGlobalSearch();
    }
}

async function runAdminGlobalSearch() {
    const input = document.getElementById('adminGlobalSearchInput');
    const query = String(input?.value || '').trim().toLowerCase();

    if (!query) {
        document.getElementById('adminContent').innerHTML = '<p class="text-muted">Type a keyword to search doctors and patients.</p>';
        return;
    }

    try {
        const [doctorResponse, patientResponse] = await Promise.all([
            axios.get('/api/admin/doctors'),
            axios.get('/api/admin/patients')
        ]);

        const doctors = (doctorResponse.data || []).filter(doctor => {
            const name = String(doctor.username || '').toLowerCase();
            const email = String(doctor.email || '').toLowerCase();
            const specialization = String(doctor.department || '').toLowerCase();
            const license = String(doctor.license_number || '').toLowerCase();
            return name.includes(query)
                || email.includes(query)
                || specialization.includes(query)
                || license.includes(query);
        });

        const patients = (patientResponse.data || []).filter(patient => {
            const id = String(patient.id || '').toLowerCase();
            const userId = String(patient.user_id || '').toLowerCase();
            const name = String(patient.username || '').toLowerCase();
            const email = String(patient.email || '').toLowerCase();
            const phone = String(patient.phone || '').toLowerCase();
            const contact = `${email} ${phone}`;
            return id.includes(query)
                || userId.includes(query)
                || name.includes(query)
                || contact.includes(query);
        });

        const doctorRows = doctors.map(doctor => {
            const actionText = doctor.is_active ? 'Deactivate' : 'Activate';
            const actionClass = doctor.is_active ? 'btn-danger' : 'btn-success';
            return `
                <tr>
                    <td>${doctor.username}</td>
                    <td>${doctor.department || '-'}</td>
                    <td>${doctor.email || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-warning me-1" onclick="editDoctor(${doctor.id})">Edit</button>
                        <button class="btn btn-sm ${actionClass}" onclick="toggleDoctorStatus(${doctor.id})">${actionText}</button>
                    </td>
                </tr>
            `;
        }).join('');

        const patientRows = patients.map(patient => {
            const actionText = patient.is_active ? 'Deactivate' : 'Activate';
            const actionClass = patient.is_active ? 'btn-danger' : 'btn-success';
            return `
                <tr>
                    <td>${patient.id}</td>
                    <td>${patient.username}</td>
                    <td>${patient.phone || '-'}</td>
                    <td>${patient.email || '-'}</td>
                    <td>
                        <button class="btn btn-sm ${actionClass}" onclick="togglePatientStatus(${patient.id})">${actionText}</button>
                    </td>
                </tr>
            `;
        }).join('');

        const doctorSection = doctors.length ? `
            <h5 class="mt-3">Doctors (${doctors.length})</h5>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Specialization</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${doctorRows}</tbody>
                </table>
            </div>
        ` : '';

        const patientSection = patients.length ? `
            <h5 class="mt-4">Patients (${patients.length})</h5>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Contact</th>
                            <th>Email</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>${patientRows}</tbody>
                </table>
            </div>
        ` : '';

        const noResultsMessage = (!doctors.length && !patients.length)
            ? '<p class="text-muted mb-0">No results found.</p>'
            : '';

        document.getElementById('adminContent').innerHTML = `
            <h3>Search Results</h3>
            <p class="text-muted">Query: <strong>${input.value}</strong></p>
            ${doctorSection}
            ${patientSection}
            ${noResultsMessage}
        `;
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to search records');
    }
}

// Show add doctor form
async function showAddDoctorForm() {
    try {
        const deptResponse = await axios.get('/api/admin/departments');
        const departments = deptResponse.data;

        const deptOptions = departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');

        const existingModal = document.getElementById('adminAddDoctorModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = `
            <div class="modal fade" id="adminAddDoctorModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add New Doctor</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="addDoctorForm">
                                <div class="mb-3">
                                    <label class="form-label">Username</label>
                                    <input type="text" class="form-control" id="docUsername" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="docEmail" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Password</label>
                                    <input type="password" class="form-control" id="docPassword" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Department</label>
                                    <select class="form-control" id="docDept" required>
                                        <option value="">Select Department</option>
                                        ${deptOptions}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">License Number</label>
                                    <input type="text" class="form-control" id="docLicense">
                                </div>
                                <div class="d-flex justify-content-end gap-2">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                    <button type="submit" class="btn btn-success">Add Doctor</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalContainer.firstElementChild);
        const modalElement = document.getElementById('adminAddDoctorModal');
        const modal = new bootstrap.Modal(modalElement);

        document.getElementById('addDoctorForm').addEventListener('submit', handleAddDoctor);
        modal.show();
    } catch (error) {
        alert('Failed to load departments');
    }
}

// Handle add doctor
async function handleAddDoctor(e) {
    e.preventDefault();
    const data = {
        username: document.getElementById('docUsername').value,
        email: document.getElementById('docEmail').value,
        password: document.getElementById('docPassword').value,
        department_id: document.getElementById('docDept').value,
        license_number: document.getElementById('docLicense').value
    };

    try {
        await axios.post('/api/admin/doctors', data);
        alert('Doctor added successfully');

        const modalElement = document.getElementById('adminAddDoctorModal');
        if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
            modalElement.remove();
        }

        loadDoctors();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to add doctor');
    }
}

// Load doctors list
async function loadDoctors() {
    try {
        const response = await axios.get('/api/admin/doctors');
        const doctors = response.data;

        let html = '<div class="d-flex justify-content-between align-items-center mb-2"><h3 class="mb-0">Doctors</h3><button class="btn btn-primary" onclick="showAddDoctorForm()">Add Doctor</button></div><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Actions</th></tr></thead><tbody>';
        doctors.forEach(doctor => {
            const actionText = doctor.is_active ? 'Deactivate' : 'Activate';
            const actionClass = doctor.is_active ? 'btn-danger' : 'btn-success';
            html += `<tr>
                <td>${doctor.username}</td>
                <td>${doctor.email}</td>
                <td>${doctor.department}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editDoctor(${doctor.id})">Edit</button>
                    <button class="btn btn-sm ${actionClass}" onclick="toggleDoctorStatus(${doctor.id})">${actionText}</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadAdminDashboard()">Back</button>';

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load doctors');
    }
}

// Toggle doctor status
async function toggleDoctorStatus(id) {
    const action = confirm('Are you sure to toggle this doctor\'s status?');
    if (action) {
        try {
            await axios.delete(`/api/admin/doctors/${id}`);
            alert('Doctor status updated');
            loadDoctors();
        } catch (error) {
            alert('Failed to update doctor status');
        }
    }
}

// edit doctor
async function editDoctor(id) {
    try {
        const docResponse = await axios.get(`/api/admin/doctors/${id}`);
        const doctor = docResponse.data;

        const deptResponse = await axios.get('/api/admin/departments');
        const departments = deptResponse.data;

        const deptOptions = departments.map(dept => `<option value="${dept.id}" ${dept.id == doctor.department_id ? 'selected' : ''}>${dept.name}</option>`).join('');

        document.getElementById('adminContent').innerHTML = `
            <h3>Edit Doctor</h3>
            <form id="editDoctorForm">
                <div class="mb-3">
                    <label class="form-label">Username</label>
                    <input type="text" class="form-control" id="editDocUsername" value="${doctor.username}" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Email</label>
                    <input type="email" class="form-control" id="editDocEmail" value="${doctor.email}" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Department</label>
                    <select class="form-control" id="editDocDept" required>
                        <option value="">Select Department</option>
                        ${deptOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">License Number</label>
                    <input type="text" class="form-control" id="editDocLicense" value="${doctor.license_number || ''}">
                </div>
                <button type="submit" class="btn btn-success">Update Doctor</button>
                <button type="button" class="btn btn-secondary" onclick="loadDoctors()">Cancel</button>
            </form>
        `;

        document.getElementById('editDoctorForm').addEventListener('submit', (e) => handleEditDoctor(e, id));
    } catch (error) {
        alert('Failed to load doctor details');
    }
}

// Handle edit doctor
async function handleEditDoctor(e, id) {
    e.preventDefault();
    const data = {
        username: document.getElementById('editDocUsername').value,
        email: document.getElementById('editDocEmail').value,
        department_id: document.getElementById('editDocDept').value,
        license_number: document.getElementById('editDocLicense').value
    };

    try {
        await axios.put(`/api/admin/doctors/${id}`, data);
        alert('Doctor updated successfully');
        loadDoctors();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to update doctor');
    }
}


// Load patients list
async function loadPatients() {
    try {
        const response = await axios.get('/api/admin/patients');
        const patients = response.data;

        let html = '<h3>Patients</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead><tbody>';
        patients.forEach(patient => {
            const actionText = patient.is_active ? 'Deactivate' : 'Activate';
            const actionClass = patient.is_active ? 'btn-danger' : 'btn-success';
            html += `<tr>
                <td>${patient.username}</td>
                <td>${patient.email}</td>
                <td>${patient.phone || ''}</td>
                <td>
                    <button class="btn btn-sm ${actionClass}" onclick="togglePatientStatus(${patient.id})">${actionText}</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadAdminDashboard()">Back</button>';

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load patients');
    }
}

// Toggle patient status
async function togglePatientStatus(id) {
    const action = confirm('Are you sure to toggle this patient\'s status?');
    if (action) {
        try {
            await axios.delete(`/api/admin/patients/${id}`);
            alert('Patient status updated');
            loadPatients();
        } catch (error) {
            alert('Failed to update patient status');
        }
    }
}

// Load appointments list
async function loadAppointments() {
    try {
        const response = await axios.get('/api/admin/appointments');
        const appointments = response.data || [];
        adminAppointmentsCache = appointments;

        let html = '<h3>Appointments</h3><table class="table"><thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            const actions = [];
            actions.push(`<button class="btn btn-sm btn-info me-1" onclick="openAdminAppointmentView(${appt.id})">View</button>`);
            if (appt.status === 'BOOKED') {
                actions.push(`<button class="btn btn-sm btn-warning" onclick="cancelAppointmentByAdmin(${appt.id})">Cancel</button>`);
            }

            html += `<tr>
                <td>${appt.patient}</td>
                <td>${appt.doctor}</td>
                <td>${appt.date}</td>
                <td>${appt.time}</td>
                <td>${appt.status}</td>
                <td>
                    ${actions.join('')}
                </td>
            </tr>`;
        });
        if (!appointments.length) {
            html += '<tr><td colspan="6" class="text-muted">No appointments found</td></tr>';
        }
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadAdminDashboard()">Back</button>';

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load appointments');
    }
}

// Update appointment status
async function updateAppointmentStatus(id, status) {
    try {
        await axios.put(`/api/admin/appointments/${id}`, { status });
        alert('Appointment updated');
        loadAppointments();
    } catch (error) {
        alert('Failed to update appointment');
    }
}

async function cancelAppointmentByAdmin(appointmentId) {
    if (!confirm('Cancel this booked appointment?')) {
        return;
    }

    try {
        await axios.put(`/api/admin/appointments/${appointmentId}`, { status: 'CANCELLED' });
        alert('Appointment cancelled');
        loadAppointments();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to cancel appointment');
    }
}

async function openAdminAppointmentView(appointmentId) {
    try {
        const response = await axios.get(`/api/admin/appointments/${appointmentId}/detail`);
        const appt = response.data;

        if (appt.status === 'COMPLETED') {
            openAdminCompletedModal(appt);
            return;
        }

        if (appt.status === 'CANCELLED') {
            openAdminCancelledModal(appt);
            return;
        }

        openAdminBookedModal(appt);
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to load appointment details');
    }
}

function openAdminCompletedModal(appt) {
    const existingModal = document.getElementById('adminViewAppointmentModal');
    if (existingModal) {
        existingModal.remove();
    }

    const medicinesRows = (appt.medicines || []).map((item, index) => `
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
        <div class="modal fade" id="adminViewAppointmentModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Patient History Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Patient:</strong> ${appt.patient_name}</p>
                        <p><strong>Doctor:</strong> ${appt.doctor_name}</p>
                        <p><strong>Department:</strong> ${appt.department}</p>
                        <p><strong>Visit Type:</strong> ${appt.visit_type || 'In-person'}</p>
                        <p><strong>Test Done:</strong> ${appt.tests_done || '-'}</p>
                        <p><strong>Diagnosis:</strong> ${appt.diagnosis || '-'}</p>
                        <p><strong>Prescription:</strong> ${appt.prescription || '-'}</p>
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
    const modalElement = document.getElementById('adminViewAppointmentModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

function openAdminCancelledModal(appt) {
    const existingModal = document.getElementById('adminCancelledAppointmentModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div class="modal fade" id="adminCancelledAppointmentModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Appointment Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Patient:</strong> ${appt.patient_name}</p>
                        <p><strong>Doctor:</strong> ${appt.doctor_name}</p>
                        <p><strong>Department:</strong> ${appt.department}</p>
                        <p><strong>Date:</strong> ${appt.date}</p>
                        <p><strong>Time:</strong> ${appt.time}</p>
                        <p><strong>Status:</strong> ${appt.status}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContainer.firstElementChild);
    const modalElement = document.getElementById('adminCancelledAppointmentModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

function openAdminBookedModal(appt) {
    const existingModal = document.getElementById('adminBookedAppointmentModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = `
        <div class="modal fade" id="adminBookedAppointmentModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Appointment Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p><strong>Patient:</strong> ${appt.patient_name}</p>
                        <p><strong>Doctor:</strong> ${appt.doctor_name}</p>
                        <p><strong>Department:</strong> ${appt.department}</p>
                        <p><strong>Date:</strong> ${appt.date}</p>
                        <p><strong>Time:</strong> ${appt.time}</p>
                        <p><strong>Status:</strong> ${appt.status}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalContainer.firstElementChild);
    const modalElement = document.getElementById('adminBookedAppointmentModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// Load departments list
async function loadDepartments() {
    try {
        const response = await axios.get('/api/admin/departments');
        const departments = response.data;

        let html = '<div class="d-flex justify-content-between align-items-center mb-2"><h3 class="mb-0">Departments</h3><button class="btn btn-primary" onclick="showAddDepartmentForm()">Add Department</button></div><table class="table"><thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>';
        departments.forEach(dept => {
            html += `<tr>
                <td>${dept.name}</td>
                <td>${dept.description || ''}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editDepartment(${dept.id}, '${dept.name}', '${dept.description}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${dept.id})">Delete</button>
                </td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += '<button class="btn btn-secondary" onclick="loadAdminDashboard()">Back</button>';

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        alert('Failed to load departments');
    }
}

// Show add department form
function showAddDepartmentForm() {
    document.getElementById('adminContent').innerHTML = `
        <h3>Add New Department</h3>
        <form id="addDepartmentForm">
            <div class="mb-3">
                <label class="form-label">Name</label>
                <input type="text" class="form-control" id="deptName" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="deptDescription" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-success">Add Department</button>
            <button type="button" class="btn btn-secondary" onclick="loadDepartments()">Cancel</button>
        </form>
    `;

    document.getElementById('addDepartmentForm').addEventListener('submit', handleAddDepartment);
}

// Handle add department
async function handleAddDepartment(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('deptName').value,
        description: document.getElementById('deptDescription').value
    };

    try {
        await axios.post('/api/admin/departments', data);
        alert('Department added successfully');
        loadDepartments();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to add department');
    }
}

// Edit department
function editDepartment(id, name, description) {
    document.getElementById('adminContent').innerHTML = `
        <h3>Edit Department</h3>
        <form id="editDepartmentForm">
            <div class="mb-3">
                <label class="form-label">Name</label>
                <input type="text" class="form-control" id="editDeptName" value="${name}" required>
            </div>
            <div class="mb-3">
                <label class="form-label">Description</label>
                <textarea class="form-control" id="editDeptDescription" rows="3">${description}</textarea>
            </div>
            <button type="submit" class="btn btn-success">Update Department</button>
            <button type="button" class="btn btn-secondary" onclick="loadDepartments()">Cancel</button>
        </form>
    `;

    document.getElementById('editDepartmentForm').addEventListener('submit', (e) => handleEditDepartment(e, id));
}

// Handle edit department
async function handleEditDepartment(e, id) {
    e.preventDefault();
    const data = {
        name: document.getElementById('editDeptName').value,
        description: document.getElementById('editDeptDescription').value
    };

    try {
        await axios.put(`/api/admin/departments/${id}`, data);
        alert('Department updated successfully');
        loadDepartments();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to update department');
    }
}

// Delete department
async function deleteDepartment(id) {
    if (confirm('Are you sure to delete this department?')) {
        try {
            await axios.delete(`/api/admin/departments/${id}`);
            alert('Department deleted');
            loadDepartments();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete department');
        }
    }
}
