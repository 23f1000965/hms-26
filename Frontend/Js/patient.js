let patientSelectedDoctorId = null;
let patientAvailabilityState = [];
let patientSelectedSlot = null;
let patientAllAppointments = [];
let patientHistoryRows = [];
let patientDoctorDirectoryCache = [];
let patientExportPollTimer = null;

async function loadPatientDashboard() {
	try {
		const [dashboardResponse, appointmentsResponse] = await Promise.all([
			axios.get('/api/patient/dashboard'),
			axios.get('/api/patient/appointments')
		]);

		const data = dashboardResponse.data;
		patientAllAppointments = appointmentsResponse.data || [];
		patientSelectedDoctorId = null;
		patientAvailabilityState = [];
		patientSelectedSlot = null;

		const departmentsWithCount = await enrichDepartmentsWithDoctorCount(data.departments || []);

		const departmentCards = departmentsWithCount.map(dept => `
			<div class="col-md-4 mb-3">
				<div class="card h-100">
					<div class="card-body d-flex flex-column">
						<h5 class="card-title">${dept.name}</h5>
						<p class="card-text text-muted">${dept.description || 'No description'}</p>
						<p class="card-text"><strong>${dept.doctor_count || 0}</strong> Doctors</p>
						<div class="mt-auto">
							<button class="btn btn-sm btn-primary" onclick="viewDepartmentDetails(${dept.id})">View Details</button>
						</div>
					</div>
				</div>
			</div>
		`).join('');

		const todayAppointments = (patientAllAppointments || []).filter(appt => appt.status === 'BOOKED' && isPatientToday(appt.date));

		const upcomingRows = (data.upcoming_rows || []).map((appt, index) => `
			<tr>
				<td>${index + 1}</td>
				<td>${appt.doctor_name}</td>
				<td>${appt.department}</td>
				<td>${formatPatientDate(appt.date)}</td>
				<td>${formatPatientTime(appt.time)}</td>
				<td><button class="btn btn-sm btn-warning" onclick="cancelPatientAppointment(${appt.id})">Cancel</button></td>
			</tr>
		`).join('');

		content.innerHTML = `
			<div>
				<div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
					<h2 class="mb-0">Patient Dashboard</h2>
					<div class="input-group" style="max-width: 430px; min-width: 280px;">
						<input type="text" class="form-control" id="patientHeaderSearchInput" placeholder="Search doctor by name/specialization" onkeydown="handlePatientHeaderSearchEnter(event)">
						<button class="btn btn-outline-primary" onclick="runPatientHeaderDoctorSearch()">Search</button>
					</div>
				</div>
				<div class="row mb-4">
					<div class="col-md-4">
						<div class="card text-center" role="button" onclick="showMyAppointments('BOOKED')" style="cursor:pointer;">
							<div class="card-body">
								<h5 class="card-title">Upcoming Appointments</h5>
								<p class="card-text display-6">${data.upcoming_appointments}</p>
							</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="card text-center" role="button" onclick="showMyAppointments('TODAY')" style="cursor:pointer;">
							<div class="card-body">
								<h5 class="card-title">Today Appointments</h5>
								<p class="card-text display-6">${todayAppointments.length}</p>
							</div>
						</div>
					</div>
					<div class="col-md-4">
						<div class="card text-center" role="button" onclick="showPatientHistory()" style="cursor:pointer;">
							<div class="card-body">
								<h5 class="card-title">Completed Appointments</h5>
								<p class="card-text display-6">${data.completed_appointments}</p>
							</div>
						</div>
					</div>
				</div>

				<div class="mb-3">
					<button class="btn btn-primary me-2" onclick="showBookAppointment()">Book Appointment</button>
					<button class="btn btn-secondary me-2" onclick="showMyAppointments()">My Appointments</button>
					<button class="btn btn-dark me-2" onclick="showPatientHistory()">History</button>
					<button class="btn btn-info me-2" onclick="showPatientProfile()">My Profile</button>
					<button class="btn btn-danger" onclick="logout()">Logout</button>
				</div>

				<div id="patientContent">
					<h4>Departments</h4>
					<div class="row">${departmentCards || '<p class="text-muted">No departments found.</p>'}</div>

					<h4 class="mt-4">Upcoming Appointments</h4>
					<div class="table-responsive">
						<table class="table table-striped">
							<thead>
								<tr>
									<th>Sr No</th>
									<th>Doctor</th>
									<th>Department</th>
									<th>Date</th>
									<th>Time</th>
									<th>Action</th>
								</tr>
							</thead>
							<tbody>${upcomingRows || '<tr><td colspan="6" class="text-muted">No upcoming appointments</td></tr>'}</tbody>
						</table>
					</div>
				</div>
			</div>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load patient dashboard');
	}
}

function handlePatientHeaderSearchEnter(event) {
	if (event.key === 'Enter') {
		event.preventDefault();
		runPatientHeaderDoctorSearch();
	}
}

async function runPatientHeaderDoctorSearch() {
	const input = document.getElementById('patientHeaderSearchInput');
	const query = String(input?.value || '').trim().toLowerCase();

	if (!query) {
		document.getElementById('patientContent').innerHTML = '<p class="text-muted">Type doctor name or specialization to search.</p>';
		return;
	}

	try {
		if (!patientDoctorDirectoryCache.length) {
			const departmentsResponse = await axios.get('/api/patient/departments');
			patientDoctorDirectoryCache = await getAllPatientDoctors(departmentsResponse.data || []);
		}

		const results = (patientDoctorDirectoryCache || []).filter(doctor => {
			const name = String(doctor.username || '').toLowerCase();
			const specialization = String(doctor.department || '').toLowerCase();
			return name.includes(query) || specialization.includes(query);
		});

		const rows = results.map((doctor, index) => `
			<tr>
				<td>${index + 1}</td>
				<td>${doctor.username}</td>
				<td>${doctor.department || '-'}</td>
				<td>${doctor.license_number || '-'}</td>
				<td>
					<button class="btn btn-sm btn-outline-secondary me-1" onclick="viewDoctorDetails(${doctor.id}, ${doctor.department_id})">View</button>
					<button class="btn btn-sm btn-outline-primary" onclick="checkDoctorAvailability(${doctor.id})">Check Availability</button>
				</td>
			</tr>
		`).join('');

		document.getElementById('patientContent').innerHTML = `
			<h4>Doctor Search Results</h4>
			<p class="text-muted">Query: <strong>${input.value}</strong></p>
			<div class="table-responsive">
				<table class="table table-striped">
					<thead>
						<tr>
							<th>Sr No</th>
							<th>Doctor</th>
							<th>Specialization</th>
							<th>License</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>${rows || '<tr><td colspan="5" class="text-muted">No doctors found</td></tr>'}</tbody>
				</table>
			</div>
			<button class="btn btn-secondary" onclick="loadPatientDashboard()">Back</button>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to search doctors');
	}
}

async function showBookAppointment() {
	try {
		const response = await axios.get('/api/patient/departments');
		const departments = await enrichDepartmentsWithDoctorCount(response.data || []);
		patientDoctorDirectoryCache = await getAllPatientDoctors(response.data || []);

		const cards = departments.map(dept => `
			<div class="col-md-4 mb-3">
				<div class="card h-100">
					<div class="card-body d-flex flex-column">
						<h5 class="card-title">${dept.name}</h5>
						<p class="card-text text-muted">${dept.description || 'No description'}</p>
						<p class="card-text"><strong>${dept.doctor_count || 0}</strong> Doctors</p>
						<div class="mt-auto">
							<button class="btn btn-sm btn-primary" onclick="viewDepartmentDetails(${dept.id})">View Details</button>
						</div>
					</div>
				</div>
			</div>
		`).join('');

		document.getElementById('patientContent').innerHTML = `
			<h3>Departments</h3>
			<div class="card mb-3">
				<div class="card-body">
					<div class="input-group">
						<input type="text" class="form-control" id="patientDoctorSearchInput" placeholder="Search doctor by name or specialization" onkeydown="handlePatientDoctorSearchEnter(event)">
						<button class="btn btn-outline-primary" onclick="runPatientDoctorSearch()">Search</button>
					</div>
					<div id="patientDoctorSearchResults" class="mt-3"></div>
				</div>
			</div>
			<div class="row">${cards || '<p class="text-muted">No departments found.</p>'}</div>
			<button class="btn btn-secondary" onclick="loadPatientDashboard()">Back</button>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load departments');
	}
}

function handlePatientDoctorSearchEnter(event) {
	if (event.key === 'Enter') {
		event.preventDefault();
		runPatientDoctorSearch();
	}
}

function runPatientDoctorSearch() {
	const input = document.getElementById('patientDoctorSearchInput');
	const query = String(input?.value || '').trim().toLowerCase();
	const resultsContainer = document.getElementById('patientDoctorSearchResults');

	if (!resultsContainer) {
		return;
	}

	if (!query) {
		resultsContainer.innerHTML = '<p class="text-muted mb-0">Type doctor name or specialization to search.</p>';
		return;
	}

	const results = (patientDoctorDirectoryCache || []).filter(doctor => {
		const name = String(doctor.username || '').toLowerCase();
		const specialization = String(doctor.department || '').toLowerCase();
		return name.includes(query) || specialization.includes(query);
	});

	const rows = results.map((doctor, index) => `
		<tr>
			<td>${index + 1}</td>
			<td>${doctor.username}</td>
			<td>${doctor.department || '-'}</td>
			<td>${doctor.license_number || '-'}</td>
			<td>
				<button class="btn btn-sm btn-outline-secondary me-1" onclick="viewDoctorDetails(${doctor.id}, ${doctor.department_id})">View</button>
				<button class="btn btn-sm btn-outline-primary" onclick="checkDoctorAvailability(${doctor.id})">Check Availability</button>
			</td>
		</tr>
	`).join('');

	resultsContainer.innerHTML = `
		<h6 class="mb-2">Doctor Results (${results.length})</h6>
		<div class="table-responsive">
			<table class="table table-striped table-sm">
				<thead>
					<tr>
						<th>#</th>
						<th>Name</th>
						<th>Specialization</th>
						<th>License</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>${rows || '<tr><td colspan="5" class="text-muted">No doctors found</td></tr>'}</tbody>
			</table>
		</div>
	`;
}

async function viewDepartmentDetails(departmentId) {
	try {
		const response = await axios.get(`/api/patient/departments/${departmentId}`);
		const dept = response.data;

		const doctorRows = (dept.doctors || []).map(doctor => `
			<tr>
				<td>${doctor.username}</td>
				<td>${doctor.license_number || ''}</td>
				<td>
					<button class="btn btn-sm btn-outline-primary me-1" onclick="checkDoctorAvailability(${doctor.id})">Check Availability</button>
					<button class="btn btn-sm btn-outline-secondary" onclick="viewDoctorDetails(${doctor.id}, ${departmentId})">View Details</button>
				</td>
			</tr>
		`).join('');

		document.getElementById('patientContent').innerHTML = `
			<h3>Department of ${dept.name}</h3>
			<p>${dept.description || 'No overview available.'}</p>
			<table class="table table-striped">
				<thead>
					<tr>
						<th>Doctor</th>
						<th>License</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>${doctorRows || '<tr><td colspan="3" class="text-muted">No doctors available</td></tr>'}</tbody>
			</table>
			<button class="btn btn-secondary" onclick="showBookAppointment()">Back</button>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load department details');
	}
}

async function viewDoctorDetails(doctorId, departmentId = null) {
	try {
		const response = await axios.get(`/api/patient/doctors/${doctorId}`);
		const doctor = response.data;

		document.getElementById('patientContent').innerHTML = `
			<div class="card">
				<div class="card-body">
					<h4>Dr. ${doctor.username}</h4>
					<p><strong>Department:</strong> ${doctor.department}</p>
					<p><strong>Email:</strong> ${doctor.email}</p>
					<p><strong>License:</strong> ${doctor.license_number || '-'}</p>
					<p>${doctor.bio || ''}</p>
					<button class="btn btn-primary me-2" onclick="checkDoctorAvailability(${doctor.id})">Check Availability</button>
					<button class="btn btn-secondary" onclick="${departmentId ? `viewDepartmentDetails(${departmentId})` : 'showBookAppointment()'}">Go Back</button>
				</div>
			</div>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load doctor details');
	}
}

async function checkDoctorAvailability(doctorId) {
	try {
		patientSelectedDoctorId = doctorId;
		patientSelectedSlot = null;

		const availabilityResponse = await axios.get(`/api/patient/doctors/${doctorId}/availability`);
		patientAvailabilityState = availabilityResponse.data.availability || [];

		document.getElementById('patientContent').innerHTML = `
			<h3>Doctor Availability</h3>
			<div id="availabilityBoard"></div>
			<div class="mt-3">
				<button class="btn btn-success me-2" onclick="bookSelectedAppointment()">Book</button>
				<button class="btn btn-secondary" onclick="showBookAppointment()">Back</button>
			</div>
		`;

		renderPatientAvailability();
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load doctor availability');
	}
}

function renderPatientAvailability() {
	const board = document.getElementById('availabilityBoard');
	if (!board) {
		return;
	}

	if (!patientSelectedDoctorId) {
		board.innerHTML = '<p class="text-muted">Select a doctor to view available slots.</p>';
		return;
	}

	const rows = patientAvailabilityState.map((day, dayIndex) => {
		const slotButtons = (day.slots || []).map(slot => {
			const isSelected = patientSelectedSlot
				&& patientSelectedSlot.dayIndex === dayIndex
				&& patientSelectedSlot.start_time === slot.start_time
				&& patientSelectedSlot.end_time === slot.end_time;

			const bookingStatus = slot.booking_status || 'AVAILABLE';
			const isBooked = bookingStatus === 'BOOKED' || bookingStatus === 'BOOKED_BY_YOU';
			const buttonText = isBooked ? 'BOOKED' : slot.label;

			const buttonClass = (!slot.is_available || isBooked)
				? 'btn-outline-danger text-danger disabled'
				: (isSelected ? 'btn-success' : 'btn-outline-success text-success');

			return `<button class="btn btn-sm me-2 mb-2 ${buttonClass}" onclick="selectPatientSlot(${dayIndex}, '${slot.start_time}', '${slot.end_time}')">${buttonText}</button>`;
		}).join('');

		return `
			<tr>
				<td><button class="btn btn-outline-secondary" disabled>${formatPatientDate(day.date)}</button></td>
				<td>${slotButtons || '<span class="text-muted">No slots</span>'}</td>
			</tr>
		`;
	}).join('');

	board.innerHTML = `
		<div class="card">
			<div class="card-body">
				<table class="table table-borderless align-middle">
					<thead>
						<tr>
							<th>Date</th>
							<th>Slots</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				<p class="mb-0"><strong>Selected:</strong> ${getSelectedSlotLabel()}</p>
			</div>
		</div>
	`;
}

function selectPatientSlot(dayIndex, startTime, endTime) {
	const day = patientAvailabilityState[dayIndex];
	if (!day) {
		return;
	}

	const slotData = (day.slots || []).find(slot => slot.start_time === startTime && slot.end_time === endTime);
	if (!slotData || !slotData.is_available || slotData.booking_status === 'BOOKED' || slotData.booking_status === 'BOOKED_BY_YOU') {
		return;
	}

	patientSelectedSlot = {
		dayIndex,
		date: day.date,
		start_time: startTime,
		end_time: endTime,
		label: slotData.label
	};

	renderPatientAvailability();
}

function getSelectedSlotLabel() {
	if (!patientSelectedSlot) {
		return 'None';
	}

	const day = patientAvailabilityState[patientSelectedSlot.dayIndex];
	if (!day) {
		return 'None';
	}

	return `${formatPatientDate(day.date)} (${patientSelectedSlot.label})`;
}

async function bookSelectedAppointment() {
	if (!patientSelectedDoctorId) {
		alert('Please select a doctor first');
		return;
	}

	if (!patientSelectedSlot) {
		alert('Please select an available slot');
		return;
	}

	try {
		await axios.post('/api/patient/appointments', {
			doctor_id: patientSelectedDoctorId,
			date: patientSelectedSlot.date,
			start_time: patientSelectedSlot.start_time,
			end_time: patientSelectedSlot.end_time
		});
		alert('Appointment booked successfully');
		loadPatientDashboard();
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to book appointment');
	}
}

async function showPatientHistory() {
	try {
		if (patientExportPollTimer) {
			clearInterval(patientExportPollTimer);
			patientExportPollTimer = null;
		}
		const historyResponse = await axios.get('/api/patient/history');

		patientHistoryRows = (historyResponse.data || [])
			.filter(row => row.status !== 'BOOKED')
			.map(row => ({ ...row }));

		const rows = patientHistoryRows.map((row, index) => `
			<tr>
				<td>${index + 1}</td>
				<td>${row.doctor_name}</td>
				<td>${row.department}</td>
				<td>${formatPatientDate(row.date)}</td>
				<td>${formatPatientTime(row.time)}</td>
				<td>${row.status}</td>
				<td><button class="btn btn-sm btn-info" onclick="openPatientHistoryViewModal(${row.appointment_id})">View</button></td>
			</tr>
		`).join('');

		document.getElementById('patientContent').innerHTML = `
			<h3>Patient History</h3>
			<div class="d-flex align-items-center gap-2 mb-3">
				<button class="btn btn-primary" id="patientExportCsvBtn" onclick="startPatientHistoryCsvExport()">Export CSV</button>
			</div>
			<div class="table-responsive">
				<table class="table table-striped">
					<thead>
						<tr>
							<th>Sr No</th>
							<th>Doctor</th>
							<th>Department</th>
							<th>Date</th>
							<th>Time</th>
							<th>Status</th>
							<th>Action</th>
						</tr>
					</thead>
					<tbody>${rows || '<tr><td colspan="7" class="text-muted">No completed or cancelled records</td></tr>'}</tbody>
				</table>
			</div>
			<button class="btn btn-secondary" onclick="loadPatientDashboard()">Back</button>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load patient history');
	}
}

async function startPatientHistoryCsvExport() {
	const button = document.getElementById('patientExportCsvBtn');
	const statusText = document.getElementById('patientExportCsvStatus');

	if (!button || !statusText) {
		return;
	}

	button.disabled = true;
	button.textContent = 'Exporting...';
	statusText.textContent = 'Starting export job...';

	try {
		const response = await axios.post('/api/patient/exports/history-csv');
		const taskId = response.data?.task_id;
		if (!taskId) {
			throw new Error('Task ID missing');
		}

		statusText.textContent = 'Export in progress...';
		startPatientHistoryExportPolling(taskId);
	} catch (error) {
		button.disabled = false;
		button.textContent = 'Export CSV';
		statusText.textContent = 'Export failed to start';
		alert(error.response?.data?.message || 'Failed to start CSV export');
	}
}

function startPatientHistoryExportPolling(taskId) {
	if (patientExportPollTimer) {
		clearInterval(patientExportPollTimer);
	}

	patientExportPollTimer = setInterval(async () => {
		const button = document.getElementById('patientExportCsvBtn');
		const statusText = document.getElementById('patientExportCsvStatus');

		if (!button || !statusText) {
			clearInterval(patientExportPollTimer);
			patientExportPollTimer = null;
			return;
		}

		try {
			const response = await axios.get(`/api/patient/exports/history-csv/${taskId}`);
			const status = String(response.data?.status || '').toUpperCase();

			if (status === 'SUCCESS') {
				clearInterval(patientExportPollTimer);
				patientExportPollTimer = null;

				button.disabled = false;
				button.textContent = 'Export CSV';
				statusText.textContent = 'Export ready. Downloading...';

				await downloadPatientHistoryCsv(taskId);
				statusText.textContent = 'CSV downloaded successfully';
				return;
			}

			if (status === 'FAILURE') {
				clearInterval(patientExportPollTimer);
				patientExportPollTimer = null;

				button.disabled = false;
				button.textContent = 'Export CSV';
				statusText.textContent = 'Export failed';
				alert(response.data?.error || 'CSV export failed');
				return;
			}

			statusText.textContent = `Export status: ${status || 'PENDING'}`;
		} catch (error) {
			clearInterval(patientExportPollTimer);
			patientExportPollTimer = null;

			button.disabled = false;
			button.textContent = 'Export CSV';
			statusText.textContent = 'Export status check failed';
		}
	}, 2000);
}

async function downloadPatientHistoryCsv(taskId) {
	const response = await axios.get(`/api/patient/exports/history-csv/${taskId}/download`, {
		responseType: 'blob'
	});

	const disposition = response.headers['content-disposition'] || '';
	const matchedFileName = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
	const fileName = decodeURIComponent((matchedFileName && (matchedFileName[1] || matchedFileName[2])) || 'history.csv');

	const blob = new Blob([response.data], { type: 'text/csv' });
	const objectUrl = window.URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = objectUrl;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	link.remove();

	window.URL.revokeObjectURL(objectUrl);
}

async function showMyAppointments(mode = 'BOOKED') {
	try {
		const response = await axios.get('/api/patient/appointments');
		const appointments = (response.data || []).filter(appt => appt.status === 'BOOKED');

		const filtered = mode === 'TODAY'
			? appointments.filter(appt => isPatientToday(appt.date))
			: appointments;

		const title = mode === 'TODAY' ? 'Today Appointments' : 'My Appointments';

		const rows = filtered.map((appt, index) => {
			return `
				<tr>
					<td>${index + 1}</td>
					<td>${appt.doctor_name}</td>
					<td>${appt.department}</td>
					<td>${formatPatientDate(appt.date)}</td>
					<td>${formatPatientTime(appt.time)}</td>
					<td>
						<button class="btn btn-sm btn-warning" onclick="cancelPatientAppointment(${appt.id}, '${mode}')">Cancel</button>
					</td>
				</tr>
			`;
		}).join('');

		document.getElementById('patientContent').innerHTML = `
			<h3>${title}</h3>
			<table class="table table-striped">
				<thead>
					<tr>
						<th>Sr No</th>
						<th>Doctor</th>
						<th>Department</th>
						<th>Date</th>
						<th>Time</th>
						<th>Action</th>
					</tr>
				</thead>
				<tbody>${rows || '<tr><td colspan="6" class="text-muted">No booked appointments found</td></tr>'}</tbody>
			</table>
			<button class="btn btn-secondary" onclick="loadPatientDashboard()">Back</button>
		`;
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load appointments');
	}
}

async function cancelPatientAppointment(appointmentId, source = 'BOOKED') {
	if (!confirm('Cancel this appointment?')) {
		return;
	}

	try {
		await axios.put(`/api/patient/appointments/${appointmentId}/cancel`);
		alert('Appointment cancelled');
		if (source === 'TODAY') {
			showMyAppointments('TODAY');
			return;
		}
		showMyAppointments('BOOKED');
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to cancel appointment');
	}
}

function openPatientHistoryViewModal(appointmentId) {
	const row = (patientHistoryRows || []).find(item => item.appointment_id === appointmentId);
	if (!row) {
		alert('Appointment details not found');
		return;
	}

	if (row.status === 'COMPLETED') {
		openPatientCompletedModal(row);
		return;
	}

	if (row.status === 'CANCELLED') {
		openPatientCancelledModal(row);
		return;
	}

	alert('Only completed/cancelled records can be viewed here');
}

function openPatientCompletedModal(row) {
	const existingModal = document.getElementById('patientHistoryViewModal');
	if (existingModal) {
		existingModal.remove();
	}

	const medicines = parsePatientMedicines(row.medicines);
	const medicinesRows = medicines.map((item, index) => `
		<tr>
			<td>${index + 1}</td>
			<td>${item.name || '-'}</td>
			<td>${item.morning || '-'}</td>
			<td>${item.afternoon || '-'}</td>
			<td>${item.night || '-'}</td>
		</tr>
	`).join('');

	const patientName = getPatientNameFromStorage();

	const modalContainer = document.createElement('div');
	modalContainer.innerHTML = `
		<div class="modal fade" id="patientHistoryViewModal" tabindex="-1" aria-hidden="true">
			<div class="modal-dialog modal-lg modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Patient History Details</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<p><strong>Patient:</strong> ${patientName}</p>
						<p><strong>Department:</strong> ${row.department || '-'}</p>
						<p><strong>Visit Type:</strong> ${row.visit_type || 'In-person'}</p>
						<p><strong>Test Done:</strong> ${row.tests_done || '-'}</p>
						<p><strong>Diagnosis:</strong> ${row.diagnosis || '-'}</p>
						<p><strong>Prescription:</strong> ${row.prescription || '-'}</p>
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
	const modalElement = document.getElementById('patientHistoryViewModal');
	const modal = new bootstrap.Modal(modalElement);
	modal.show();
}

function openPatientCancelledModal(row) {
	const existingModal = document.getElementById('patientCancelledViewModal');
	if (existingModal) {
		existingModal.remove();
	}

	const patientName = getPatientNameFromStorage();

	const modalContainer = document.createElement('div');
	modalContainer.innerHTML = `
		<div class="modal fade" id="patientCancelledViewModal" tabindex="-1" aria-hidden="true">
			<div class="modal-dialog modal-dialog-centered">
				<div class="modal-content">
					<div class="modal-header">
						<h5 class="modal-title">Appointment Details</h5>
						<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
					</div>
					<div class="modal-body">
						<p><strong>Patient:</strong> ${patientName}</p>
						<p><strong>Department:</strong> ${row.department || '-'}</p>
						<p><strong>Date:</strong> ${formatPatientDate(row.date)}</p>
						<p><strong>Time:</strong> ${formatPatientTime(row.time)}</p>
						<p><strong>Status:</strong> ${row.status}</p>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
					</div>
				</div>
			</div>
		</div>
	`;

	document.body.appendChild(modalContainer.firstElementChild);
	const modalElement = document.getElementById('patientCancelledViewModal');
	const modal = new bootstrap.Modal(modalElement);
	modal.show();
}

async function enrichDepartmentsWithDoctorCount(departments) {
	const rows = await Promise.all((departments || []).map(async dept => {
		try {
			const detailResponse = await axios.get(`/api/patient/departments/${dept.id}`);
			const doctors = detailResponse.data?.doctors || [];
			return {
				...dept,
				doctor_count: doctors.length
			};
		} catch (error) {
			return {
				...dept,
				doctor_count: 0
			};
		}
	}));

	return rows;
}

async function getAllPatientDoctors(departments) {
	const allDoctors = [];

	await Promise.all((departments || []).map(async dept => {
		try {
			const detailResponse = await axios.get(`/api/patient/departments/${dept.id}`);
			const doctors = detailResponse.data?.doctors || [];
			doctors.forEach(doctor => {
				allDoctors.push({
					id: doctor.id,
					username: doctor.username,
					license_number: doctor.license_number,
					department: dept.name,
					department_id: dept.id,
				});
			});
		} catch (error) {
			// ignore department-level fetch errors
		}
	}));

	return allDoctors;
}

function parsePatientMedicines(text) {
	if (!text || text === '-') {
		return [];
	}

	const parts = String(text).split(',').map(item => item.trim()).filter(Boolean);
	return parts.map(item => {
		const match = item.match(/^(.*)\(([^-]*)-([^-]*)-([^)]*)\)$/);
		if (match) {
			return {
				name: match[1].trim(),
				morning: match[2].trim() || '-',
				afternoon: match[3].trim() || '-',
				night: match[4].trim() || '-'
			};
		}

		return {
			name: item,
			morning: '-',
			afternoon: '-',
			night: '-'
		};
	});
}

function isPatientToday(dateText) {
	if (!dateText) {
		return false;
	}

	const datePart = String(dateText).split('T')[0];
	const today = new Date();
	const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	return datePart === todayIso;
}

function getPatientNameFromStorage() {
	try {
		const user = JSON.parse(localStorage.getItem('user') || 'null');
		return user?.username || 'Patient';
	} catch (error) {
		return 'Patient';
	}
}

async function showPatientProfile() {
	try {
		const response = await axios.get('/api/patient/profile');
		const profile = response.data;

		const existingModal = document.getElementById('patientProfileModal');
		if (existingModal) {
			existingModal.remove();
		}

		const modalContainer = document.createElement('div');
		modalContainer.innerHTML = `
			<div class="modal fade" id="patientProfileModal" tabindex="-1" aria-hidden="true">
				<div class="modal-dialog modal-dialog-centered">
					<div class="modal-content">
						<div class="modal-header">
							<h5 class="modal-title">My Profile</h5>
							<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
						</div>
						<div class="modal-body">
							<form id="patientProfileForm">
								<div class="mb-3">
									<label class="form-label">Username</label>
									<input type="text" class="form-control" id="patientProfileUsername" value="${profile.username}" required>
								</div>
								<div class="mb-3">
									<label class="form-label">Email</label>
									<input type="email" class="form-control" id="patientProfileEmail" value="${profile.email}" required>
								</div>
								<div class="mb-3">
									<label class="form-label">Date of Birth</label>
									<input type="date" class="form-control" id="patientProfileDob" value="${profile.date_of_birth || ''}">
								</div>
								<div class="mb-3">
									<label class="form-label">Phone</label>
									<input type="text" class="form-control" id="patientProfilePhone" value="${profile.phone || ''}">
								</div>
								<div class="mb-3">
									<label class="form-label">Address</label>
									<textarea class="form-control" id="patientProfileAddress" rows="3">${profile.address || ''}</textarea>
								</div>
								<div class="mb-3">
									<label class="form-label">Emergency Contact</label>
									<input type="text" class="form-control" id="patientProfileEmergency" value="${profile.emergency_contact || ''}">
								</div>
							</form>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
							<button type="button" class="btn btn-success" id="savePatientProfileBtn">Save Changes</button>
						</div>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(modalContainer.firstElementChild);
		const modalElement = document.getElementById('patientProfileModal');
		const modal = new bootstrap.Modal(modalElement);

		document.getElementById('savePatientProfileBtn').addEventListener('click', updatePatientProfile);
		modal.show();
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to load profile');
	}
}

async function updatePatientProfile() {

	const payload = {
		username: document.getElementById('patientProfileUsername').value,
		email: document.getElementById('patientProfileEmail').value,
		date_of_birth: document.getElementById('patientProfileDob').value || null,
		phone: document.getElementById('patientProfilePhone').value,
		address: document.getElementById('patientProfileAddress').value,
		emergency_contact: document.getElementById('patientProfileEmergency').value
	};

	try {
		await axios.put('/api/patient/profile', payload);
		alert('Profile updated successfully');

		const existingUser = JSON.parse(localStorage.getItem('user') || 'null');
		if (existingUser) {
			existingUser.username = payload.username;
			existingUser.email = payload.email;
			localStorage.setItem('user', JSON.stringify(existingUser));
		}

		const modalElement = document.getElementById('patientProfileModal');
		if (modalElement) {
			const modalInstance = bootstrap.Modal.getInstance(modalElement);
			if (modalInstance) {
				modalInstance.hide();
			}
			modalElement.remove();
		}

		loadPatientDashboard();
	} catch (error) {
		alert(error.response?.data?.message || 'Failed to update profile');
	}
}

function formatPatientDate(dateText) {
	const parsed = new Date(dateText);
	if (Number.isNaN(parsed.getTime())) {
		return dateText;
	}
	return parsed.toLocaleDateString('en-GB');
}

function formatPatientTime(timeText) {
	const [hours = '00', minutes = '00'] = String(timeText).split(':');
	const hourNumber = Number(hours);
	const suffix = hourNumber >= 12 ? 'PM' : 'AM';
	const hour12 = hourNumber % 12 === 0 ? 12 : hourNumber % 12;
	return `${hour12}:${minutes} ${suffix}`;
}
