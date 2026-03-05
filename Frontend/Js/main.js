// Base URL API ke liye
const API_BASE = 'http://localhost:5000';

// Axios ka configuration
axios.defaults.baseURL = API_BASE;

// jwt ke liye request interceptor
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// error handling ke liye response interceptor
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 || error.response?.status === 422) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showLogin();
    }
    return Promise.reject(error);
  }
);

// element DOM se lena
const content = document.getElementById('content');

// Show welcome page
function showWelcome() {
    content.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-body">
                        <h2 class="card-title text-center">Welcome to HMS</h2>
                        <p class="text-center">Please login or register to continue.</p>
                        <div class="d-grid gap-2">
                            <button class="btn btn-primary" onclick="showLogin()">Login</button>
                            <button class="btn btn-secondary" onclick="showRegister()">Register as Patient</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Show login form
function showLogin() {
    content.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-body">
                        <h2 class="card-title text-center">Login</h2>
                        <form id="loginForm">
                            <div class="mb-3">
                                <label class="form-label">Username</label>
                                <input type="text" class="form-control" id="loginUsername" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Password</label>
                                <input type="password" class="form-control" id="loginPassword" required>
                            </div>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary">Login</button>
                            </div>
                        </form>
                        <div class="text-center mt-3">
                            <a href="#" onclick="showRegister()">Don't have an account? Register</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

// Show register form
function showRegister() {
    content.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-body">
                        <h2 class="card-title text-center">Register as Patient</h2>
                        <form id="registerForm">
                            <div class="mb-3">
                                <label class="form-label">Username</label>
                                <input type="text" class="form-control" id="regUsername" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" id="regEmail" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Password</label>
                                <input type="password" class="form-control" id="regPassword" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Date of Birth</label>
                                <input type="date" class="form-control" id="regDob">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Phone</label>
                                <input type="text" class="form-control" id="regPhone">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Address</label>
                                <textarea class="form-control" id="regAddress" rows="3"></textarea>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Emergency Contact</label>
                                <input type="text" class="form-control" id="regEmergency">
                            </div>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-success">Register</button>
                            </div>
                        </form>
                        <div class="text-center mt-3">
                            <a href="#" onclick="showLogin()">Already have an account? Login</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('registerForm').addEventListener('submit', handleRegister);
}

// login handle ho raha  ha
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await axios.post('/api/auth/login', { username, password });
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        showDashboard(response.data.user);
    } catch (error) {
        alert(error.response?.data?.message || 'Login failed');
    }
}

// register handle ho raha ha
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const date_of_birth = document.getElementById('regDob').value;
    const phone = document.getElementById('regPhone').value;
    const address = document.getElementById('regAddress').value;
    const emergency_contact = document.getElementById('regEmergency').value;

    try {
        await axios.post('/api/auth/register', { 
            username, 
            email, 
            password, 
            date_of_birth, 
            phone, 
            address, 
            emergency_contact 
        });
        alert('Registration successful! Please login.');
        showLogin();
    } catch (error) {
        alert(error.response?.data?.message || 'Registration failed');
    }
}

// role ke hisab se dashboard dikhana
function showDashboard(user) {
    if (user.role === 'ADMIN') {
        loadAdminDashboard();
    } else if (user.role === 'DOCTOR') {
        loadDoctorDashboard();
    } else if (user.role === 'PATIENT') {
        loadPatientDashboard();
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showWelcome();
}

// Authentication check karna jab page load ho
function checkAuth() {
    localStorage.clear();  
    showWelcome();
}

// Initialize hoga jab DOM content loaded hota hai
document.addEventListener('DOMContentLoaded', checkAuth);