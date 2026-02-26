export const API_BASE = ''; // Relative path since embedded

export const fetchCameras = async () => {
    const res = await fetch(`${API_BASE}/cameras/`);
    return res.json();
};

export const fetchAddedCameras = async () => {
    const res = await fetch(`${API_BASE}/api/added_cameras/`);
    return res.json();
};

export const addCamera = async (id, label) => {
    const res = await fetch(`${API_BASE}/add_camera/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, label })
    });
    return res.json();
};

export const setMainCamera = async (id) => {
    await fetch(`${API_BASE}/set_main/${id}/`);
};

export const setRoi = async (payload) => {
    await fetch(`${API_BASE}/api/set_roi/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
};

export const fetchStats = async () => {
    const res = await fetch(`${API_BASE}/api/stats/`);
    return res.json();
};

export const fetchEmergencyStatus = async () => {
    const res = await fetch(`${API_BASE}/api/emergency_status/`);
    return res.json();
};

export const simulateThreat = async (type) => {
    await fetch(`${API_BASE}/api/simulate_threat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
    });
};

export const registerSample = async (payload) => {
    const res = await fetch(`${API_BASE}/admin/register_samples/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    return res.json();
};

export const addPerson = async (formData) => {
    const res = await fetch(`${API_BASE}/admin/add/`, {
        method: 'POST',
        body: formData
    });
    return res.json();
};

export const updatePerson = async (serial_no, formData) => {
    const res = await fetch(`${API_BASE}/admin/update/${serial_no}/`, {
        method: 'POST',
        body: formData
    });
    return res.json();
};

export const deletePerson = async (serial_no) => {
    const res = await fetch(`${API_BASE}/admin/delete/${serial_no}/`);
    return res.json();
};

// Auth API
export const apiLogin = async (email, password) => {
    const res = await fetch(`${API_BASE}/api/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    return res.json();
};

export const apiRegister = async (name, email, password) => {
    const res = await fetch(`${API_BASE}/api/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    return res.json();
};

export const addContact = async (name, phone, relation) => {
    const res = await fetch(`${API_BASE}/api/add_contact/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, relation })
    });
    return res.json();
};

export const deleteContact = async (id) => {
    const res = await fetch(`${API_BASE}/api/delete_contact/${id}/`, {
        method: 'DELETE'
    });
    return res.json();
};

// New API functions
export const fetchPersons = async () => {
    const res = await fetch(`${API_BASE}/api/persons/`);
    return res.json();
};

export const fetchContacts = async () => {
    const res = await fetch(`${API_BASE}/api/contacts/`);
    return res.json();
};

export const fetchLogs = async () => {
    const res = await fetch(`${API_BASE}/api/logs/`);
    return res.json();
};

export const deleteLog = async (id) => {
    const res = await fetch(`${API_BASE}/api/delete_log/${id}/`, {
        method: 'DELETE'
    });
    return res.json();
};
