// Load admin dashboard
async function loadAdminDashboard() {
    try {
        const response = await axios.get('/api/admin/dashboard');
        const stats = response.data;

        content.innerHTML = `
            <h2>Admin Dashboard</h2>
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title">Total Doctors</h5>
                            <p class="card-text display-4">${stats.total_doctors}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title">Total Patients</h5>
                            <p class="card-text display-4">${stats.total_patients}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <h5 class="card-title">Total Appointments</h5>
                            <p class="card-text display-4">${stats.total_appointments}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <button class="btn btn-primary me-2" onclick="showAddDoctorForm()">Add Doctor</button>
                <button class="btn btn-secondary me-2" onclick="loadDoctors()">Manage Doctors</button>
                <button class="btn btn-info me-2" onclick="loadPatients()">Manage Patients</button>
                <button class="btn btn-warning me-2" onclick="loadAppointments()">Manage Appointments</button>
                <button class="btn btn-success me-2" onclick="loadDepartments()">Manage Departments</button>
                <button class="btn btn-danger" onclick="logout()">Logout</button>
            </div>
            <div id="adminContent"></div>
        `;
    } catch (error) {
        alert('Failed to load dashboard');
    }
}

// Show while adding doctor (form)
async function showAddDoctorForm() {
    try {
        const deptResponse = await axios.get('/api/admin/departments');
        const departments = deptResponse.data;

        const deptOptions = departments.map(dept => `<option value="${dept.id}">${dept.name}</option>`).join('');

        document.getElementById('adminContent').innerHTML = `
            <h3>Add New Doctor</h3>
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
                <button type="submit" class="btn btn-success">Add Doctor</button>
                <button type="button" class="btn btn-secondary" onclick="loadAdminDashboard()">Cancel</button>
            </form>
        `;

        document.getElementById('addDoctorForm').addEventListener('submit', handleAddDoctor);
    } catch (error) {
        alert('Failed to load departments');
    }
}

// Handling add doctor
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
        loadAdminDashboard();
    } catch (error) {
        alert(error.response?.data?.message || 'Failed to add doctor');
    }
}

// Load doctors list
async function loadDoctors() {
    try {
        const response = await axios.get('/api/admin/doctors');
        const doctors = response.data;

        let html = '<h3>Doctors</h3><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Actions</th></tr></thead><tbody>';
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
        const appointments = response.data;

        let html = '<h3>Appointments</h3><table class="table"><thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        appointments.forEach(appt => {
            html += `<tr>
                <td>${appt.patient}</td>
                <td>${appt.doctor}</td>
                <td>${appt.date}</td>
                <td>${appt.time}</td>
                <td>${appt.status}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="updateAppointmentStatus(${appt.id}, 'COMPLETED')">Complete</button>
                    <button class="btn btn-sm btn-warning" onclick="updateAppointmentStatus(${appt.id}, 'CANCELLED')">Cancel</button>
                </td>
            </tr>`;
        });
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

// Load departments list
async function loadDepartments() {
    try {
        const response = await axios.get('/api/admin/departments');
        const departments = response.data;

        let html = '<h3>Departments</h3><table class="table"><thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead><tbody>';
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
        html += '<button class="btn btn-primary me-2" onclick="showAddDepartmentForm()">Add Department</button>';
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
