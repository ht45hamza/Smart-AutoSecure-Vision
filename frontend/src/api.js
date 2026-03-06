export const API_BASE = ''; // Relative path since embedded

const getAuthHeaders = (isJson = true) => {
    const userStr = localStorage.getItem('autosecure_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const headers = {};
    if (isJson) headers['Content-Type'] = 'application/json';
    if (user && user.email) headers['X-User-Email'] = user.email;
    return headers;
};

export const fetchCameras = async () => {
    const res = await fetch(`${API_BASE}/cameras/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const fetchAddedCameras = async () => {
    const res = await fetch(`${API_BASE}/api/added_cameras/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const addCamera = async (id, label) => {
    const res = await fetch(`${API_BASE}/add_camera/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, label })
    });
    return res.json();
};

export const setMainCamera = async (id) => {
    await fetch(`${API_BASE}/set_main/${id}/`, { headers: getAuthHeaders(false) });
};

export const setRoi = async (payload) => {
    await fetch(`${API_BASE}/api/set_roi/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
};

export const fetchStats = async () => {
    const res = await fetch(`${API_BASE}/api/stats/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const fetchEmergencyStatus = async () => {
    const res = await fetch(`${API_BASE}/api/emergency_status/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const simulateThreat = async (type) => {
    await fetch(`${API_BASE}/api/simulate_threat/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type })
    });
};

export const registerSample = async (payload) => {
    const res = await fetch(`${API_BASE}/admin/register_samples/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
    });
    return res.json();
};

export const addPerson = async (formData) => {
    const res = await fetch(`${API_BASE}/admin/add/`, {
        method: 'POST',
        headers: getAuthHeaders(false),
        body: formData
    });
    return res.json();
};

export const updatePerson = async (serial_no, formData) => {
    const res = await fetch(`${API_BASE}/admin/update/${serial_no}/`, {
        method: 'POST',
        headers: getAuthHeaders(false),
        body: formData
    });
    return res.json();
};

export const deletePerson = async (serial_no) => {
    const res = await fetch(`${API_BASE}/admin/delete/${serial_no}/`, { headers: getAuthHeaders(false) });
    return res.json();
};

// Auth API
export const apiLogin = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/login/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, password })
    });
    return res.json();
};

export const apiRegister = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/api/register/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, email, password })
    });
    return res.json();
};

export const apiVerifyOtp = async (email, otp) => {
    const res = await fetch(`${API_BASE}/api/verify_email/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ email, otp })
    });
    return res.json();
};

export const apiGoogleLogin = async (token) => {
    const res = await fetch(`${API_BASE}/api/google_login/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ token })
    });
    return res.json();
};

export const apiForgotPassword = async (step, email, otp = null, password = null) => {
    const res = await fetch(`${API_BASE}/api/forgot_password/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ step, email, otp, password })
    });
    return res.json();
};

export const addContact = async (name, phone, relation) => {
    const res = await fetch(`${API_BASE}/api/add_contact/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, phone, relation })
    });
    return res.json();
};

export const deleteContact = async (id) => {
    const res = await fetch(`${API_BASE}/api/delete_contact/${id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(false)
    });
    return res.json();
};

// New API functions
export const fetchPersons = async () => {
    const res = await fetch(`${API_BASE}/api/persons/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const fetchContacts = async () => {
    const res = await fetch(`${API_BASE}/api/contacts/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const fetchLogs = async () => {
    const res = await fetch(`${API_BASE}/api/logs/`, { headers: getAuthHeaders(false) });
    return res.json();
};

export const deleteLog = async (id) => {
    const res = await fetch(`${API_BASE}/api/delete_log/${id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(false)
    });
    return res.json();
};
