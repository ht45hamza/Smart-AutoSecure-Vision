import React, { useState } from 'react';

const Settings = () => {
    const [notifications, setNotifications] = useState(true);
    const [sound, setSound] = useState(true);
    const [sensitivity, setSensitivity] = useState(75);
    const [theme, setTheme] = useState('dark');

    const handleSave = () => {
        alert("Settings Saved Successfully!");
    };

    return (
        <div className="container-fluid p-4 animate-fade-in h-100 overflow-auto">
            <h2 className="mb-4 fw-bold text-uppercase border-bottom border-secondary pb-3">
                <i className="fas fa-cog me-2 text-secondary"></i> System Settings
            </h2>

            <div className="row g-4">
                <div className="col-lg-6">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-dark-header fw-bold text-white">
                            <i className="fas fa-bell me-2 text-warning"></i> Notifications & Alerts
                        </div>
                        <div className="card-body">
                            <div className="form-check form-switch mb-3">
                                <input className="form-check-input" type="checkbox" id="notifSwitch" checked={notifications} onChange={() => setNotifications(!notifications)} />
                                <label className="form-check-label text-light" htmlFor="notifSwitch">Enable Desktop Notifications</label>
                            </div>
                            <div className="form-check form-switch mb-3">
                                <input className="form-check-input" type="checkbox" id="soundSwitch" checked={sound} onChange={() => setSound(!sound)} />
                                <label className="form-check-label text-light" htmlFor="soundSwitch">Play Alert Sound</label>
                            </div>
                            <div className="mb-3">
                                <label className="form-label text-secondary small">Notification Email</label>
                                <input type="email" className="form-control bg-dark text-white border-secondary" placeholder="admin@example.com" disabled />
                                <small className="text-muted">Managed in Account Settings</small>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card shadow-sm h-100">
                        <div className="card-header bg-dark-header fw-bold text-white">
                            <i className="fas fa-eye me-2 text-info"></i> Detection Config
                        </div>
                        <div className="card-body">
                            <div className="mb-4">
                                <label className="form-label text-light d-flex justify-content-between">
                                    <span>AI Sensitivity Threshold</span>
                                    <span className="badge bg-primary">{sensitivity}%</span>
                                </label>
                                <input
                                    type="range"
                                    className="form-range"
                                    min="0" max="100"
                                    value={sensitivity}
                                    onChange={(e) => setSensitivity(e.target.value)}
                                />
                                <div className="d-flex justify-content-between small text-secondary">
                                    <span>Low (More False Positives)</span>
                                    <span>High (Strict)</span>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label text-light">Default View Mode</label>
                                <select className="form-select bg-dark text-white border-secondary">
                                    <option>Grid View (All Cameras)</option>
                                    <option>Main Focus (Single Camera)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 text-end">
                    <button className="btn btn-outline-secondary me-2">Reset Defaults</button>
                    <button className="btn btn-success px-4" onClick={handleSave}><i className="fas fa-save me-2"></i> Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
