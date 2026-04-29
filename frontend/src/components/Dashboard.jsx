import React, { useState, useEffect, useRef } from 'react';
import { fetchAddedCameras, setMainCamera, fetchStats, fetchEmergencyStatus, addCamera, fetchCameras, generateQrSession } from '../api';
import ROImodal from './ROImodal';

import Sidebar from './Sidebar';
import Logs from './Logs';
import Contacts from './Contacts';
import Admin from './Admin';
import Help from './Help';
import About from './About';
import Settings from './Settings';
import UserManagement from './UserManagement';

// Role-based access: which views each role can access
const ROLE_ACCESS = {
    admin: ['dashboard', 'logs', 'contacts', 'admin', 'users', 'settings', 'help', 'about'],
    manager: ['dashboard', 'logs', 'contacts', 'admin', 'settings', 'help', 'about'],
    security_guard: ['dashboard', 'logs'],
    owner: ['logs'],
};

const canAccess = (role, view) => {
    const allowed = ROLE_ACCESS[role] || ROLE_ACCESS.admin;
    return allowed.includes(view);
};

const getDefaultView = (role) => {
    const allowed = ROLE_ACCESS[role] || ROLE_ACCESS.admin;
    return allowed[0] || 'dashboard';
};

// ─── Dashboard Content (Camera + Stats + Activity) ─────────────────────────
const DashboardContent = ({ onNavigate, user }) => {
    const [cameras, setCameras] = useState([]);
    const [mainCameraId, setMainCameraId] = useState(null);
    const [stats, setStats] = useState({ known: 0, unknown: 0, suspects: 0, history: [] });
    const [emergency, setEmergency] = useState({ active: false });
    const [showAddCameraModal, setShowAddCameraModal] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [newCamData, setNewCamData] = useState({ id: '', label: '' });
    const [cameraMode, setCameraMode] = useState('local'); // 'local' | 'ip' | 'qr'
    const [ipCamData, setIpCamData] = useState({ url: '', label: '' });
    const [showRoiModal, setShowRoiModal] = useState(false);
    const [roiCameraId, setRoiCameraId] = useState(null);
    const [selectedLog, setSelectedLog] = useState(null);
    const [addingCam, setAddingCam] = useState(false);
    const [qrData, setQrData] = useState(null); // { token, qr_image, url }
    const [qrLabel, setQrLabel] = useState('Mobile Camera');
    const [isPollingStatus, setIsPollingStatus] = useState(false);

    const role = user?.role || 'admin';

    const getSeverityBadge = (level) => {
        switch (level) {
            case 'Critical': return <span className="badge bg-danger">CRITICAL</span>;
            case 'High': return <span className="badge bg-warning text-dark">HIGH</span>;
            case 'Medium': return <span className="badge bg-info text-dark">MEDIUM</span>;
            default: return <span className="badge bg-secondary">LOW</span>;
        }
    };

    const enrichLog = (item) => {
        let severity = 'Low', type = 'Info';
        if (item.name === 'System') {
            severity = item.action?.toLowerCase().includes('weapon') ? 'Critical' : 'Medium';
            type = 'System';
        } else if (item.relation === 'Suspect') {
            severity = 'High'; type = 'Person';
        } else if (item.relation === 'Visual') {
            severity = 'Medium'; type = 'Person';
        }
        return { ...item, severity, type };
    };

    const openRoi = (id) => { setRoiCameraId(id); setShowRoiModal(true); };

    const handleOpenAddModal = async () => {
        try {
            const avail = await fetchCameras();
            setAvailableCameras(avail);
            if (avail.length > 0) setNewCamData({ id: avail[0].id, label: avail[0].label });
            setQrData(null);
            setIsPollingStatus(false);
            setShowAddCameraModal(true);
        } catch { alert("Error fetching available cameras"); }
    };

    const handleGenerateQr = async () => {
        setAddingCam(true);
        try {
            const data = await generateQrSession(qrLabel);
            if (data.success) {
                setQrData(data);
                setIsPollingStatus(true);
            } else {
                alert("Failed to generate QR session");
            }
        } catch (err) {
            alert("Error generating QR: " + err.message);
        }
        setAddingCam(false);
    };

    useEffect(() => {
        let pollInterval;
        if (isPollingStatus && qrData?.token) {
            pollInterval = setInterval(async () => {
                try {
                    const resp = await fetch(`/api/mobile_cam/status_update/${qrData.token}/`);
                    const data = await resp.json();
                    if (data.active) {
                        setIsPollingStatus(false);
                        setShowAddCameraModal(false);
                        setQrData(null);
                        loadCameras();
                        alert("✅ Mobile camera connected via QR!");
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 3000);
        }
        return () => clearInterval(pollInterval);
    }, [isPollingStatus, qrData]);

    const handleAddCamera = async (e) => {
        e.preventDefault();
        setAddingCam(true);
        try {
            if (cameraMode === 'ip') {
                if (!ipCamData.url.trim()) { alert('Please enter a valid camera URL.'); setAddingCam(false); return; }
                const url = ipCamData.url.trim();
                const label = ipCamData.label.trim() || `IP Cam (${url.split('/')[2] || url})`;
                const resp = await fetch('/add_camera/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-User-Email': localStorage.getItem('admin_email') || localStorage.getItem('user_email') || '' },
                    body: JSON.stringify({ id: url, label, type: 'ip' })
                });
                const result = await resp.json();
                if (result.success) {
                    setShowAddCameraModal(false);
                    setIpCamData({ url: '', label: '' });
                    loadCameras();
                    alert(`✅ Mobile/IP camera connected: ${label}`);
                } else {
                    alert(`❌ Failed: ${result.message}`);
                }
            } else {
                await addCamera(parseInt(newCamData.id), newCamData.label || `Camera ${newCamData.id}`);
                setShowAddCameraModal(false);
                setNewCamData({ id: '', label: '' });
                loadCameras();
                alert('✅ Camera Added Successfully');
            }
        } catch (err) {
            alert(`❌ Error: ${err.message || 'Failed to connect to camera.'}`);
        }
        setAddingCam(false);
    };

    useEffect(() => {
        loadCameras();
        const interval = setInterval(loadStats, 2000);
        const emergInterval = setInterval(checkEmergency, 1000);
        return () => { clearInterval(interval); clearInterval(emergInterval); };
    }, []);

    const loadCameras = async () => {
        try {
            const data = await fetchAddedCameras();
            setCameras(data);
            const main = data.find(c => c.main);
            if (main) setMainCameraId(main.id);
            else if (data.length > 0) setMainCameraId(data[0].id);
        } catch (e) { console.error("Failed to load cameras", e); }
    };

    const loadStats = async () => {
        try { const data = await fetchStats(); setStats(data); } catch {}
    };

    const checkEmergency = async () => {
        try { const data = await fetchEmergencyStatus(); setEmergency(data); } catch {}
    };

    const handleSetMain = async (id) => {
        await setMainCamera(id);
        setMainCameraId(id);
        loadCameras();
    };

    return (
        <div className="d-flex flex-column h-100 bg-dark-theme text-light font-sans animate-fade-in">
            {/* Emergency Banner */}
            {emergency.active && (
                <div className="bg-danger text-white text-center py-2 fw-bold animate-pulse" style={{ zIndex: 999 }}>
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    EMERGENCY: {emergency.threat} — {emergency.message}
                </div>
            )}
            <div className="container-fluid p-4 flex-grow-1 overflow-hidden">
                <div className="row g-4 h-lg-100 overflow-y-auto overflow-lg-hidden pb-5 pb-lg-0">
                    {/* LEFT: STATS */}
                    <div className="col-12 col-md-12 col-lg-3 col-xl-2 order-2 order-lg-1 h-auto h-lg-100 overflow-y-auto custom-scrollbar">
                        <div className="row g-3 flex-lg-column h-100">
                            {[
                                { val: stats.known, label: 'Known', color: 'success', icon: 'fa-user-check' },
                                { val: stats.unknown, label: 'Unknown', color: 'warning', icon: 'fa-user-secret' },
                                { val: stats.suspects, label: 'Suspects', color: 'danger', icon: 'fa-exclamation-triangle' },
                                { val: stats.history?.length || 0, label: 'Events', color: 'primary', icon: 'fa-chart-bar' },
                            ].map(({ val, label, color, icon }) => (
                                <div className="col-6 col-md-3 col-lg-12" key={label}>
                                    <div className={`stat-card-enhanced border-start border-${color} shadow-sm h-100 d-flex flex-column justify-content-between`} style={{ minHeight: '130px' }}>
                                        <div>
                                            <h2 className="text-light fw-bold mb-0 display-6">{val}</h2>
                                            <p className={`text-${color} small text-uppercase mb-0 tracking-wider font-monospace`}>{label}</p>
                                        </div>
                                        <i className={`fas ${icon} stat-icon-bg text-${color} display-4 opacity-10 position-absolute bottom-0 end-0 m-2`}></i>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* CENTER: VIDEO */}
                    <div className="col-12 col-md-12 col-lg-6 col-xl-7 d-flex flex-column gap-3 order-1 order-lg-2" style={{ minHeight: '400px' }}>
                        <div className="main-video-container flex-grow-1 position-relative bg-black rounded-3 border border-dark-subtle overflow-hidden d-flex align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                            <div className="ratio ratio-16x9 w-100 h-100" style={{ maxHeight: '100%' }}>
                                {mainCameraId !== null ? (
                                    <img key={mainCameraId} src={`/video_feed/${mainCameraId}/?t=${Date.now()}`} className="w-100 h-100 object-fit-contain" alt="Main Feed"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/800x600?text=Signal+Lost'; }} />
                                ) : (
                                    <div className="d-flex flex-column align-items-center justify-content-center text-secondary w-100 h-100">
                                        <i className="fas fa-video-slash fa-3x mb-3 opacity-50"></i><h6>NO SIGNAL</h6>
                                    </div>
                                )}
                            </div>
                            {/* Overlays on top of ratio */}
                            {mainCameraId !== null && (<>
                                <div className="position-absolute top-0 start-0 m-2 px-2 py-1 bg-danger text-white rounded-1 small fw-bold" style={{ zIndex: 10 }}>
                                    <span className="blink-dot bg-white me-2"></span>LIVE
                                </div>
                                {canAccess(role, 'admin') && (
                                    <button
                                        className="btn btn-sm btn-primary position-absolute d-flex align-items-center gap-2"
                                        style={{ bottom: '12px', right: '12px', zIndex: 10, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRoi(mainCameraId); }}
                                        title="Edit Region of Interest"
                                    >
                                        <i className="fas fa-crop-alt"></i>
                                        <span className="d-none d-md-inline">Set ROI</span>
                                    </button>
                                )}
                            </>)}
                        </div>
                        <div className="camera-grid-row d-flex gap-3 overflow-x-auto pb-2 custom-scrollbar" style={{ height: '120px' }}>
                            {cameras.map(cam => (
                                <div key={cam.id} className={`camera-thumbnail position-relative rounded-3 overflow-hidden flex-shrink-0 cursor-pointer ${mainCameraId === cam.id ? 'active-cam border border-primary border-2' : 'border border-secondary'}`}
                                    style={{ width: '180px', background: '#000' }} onClick={() => handleSetMain(cam.id)}>
                                    <img src={`/video_feed/${cam.id}/?t=${Date.now()}`} className="w-100 h-100 object-fit-cover opacity-75 hover-opacity-100 transition-all" alt={cam.label} />
                                    <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-to-t from-black to-transparent">
                                        <span className={`badge ${mainCameraId === cam.id ? 'bg-primary' : 'bg-secondary'} small rounded-1 fw-normal`}>{cam.label}</span>
                                    </div>
                                </div>
                            ))}
                            {cameras.length === 0 && (
                                <div className="d-flex align-items-center justify-content-center border border-secondary border-dashed rounded-3 text-secondary small w-100">No Cameras Detected</div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: LOGS + ADD CAMERA */}
                    <div className="col-12 col-md-12 col-lg-3 col-xl-3 d-flex flex-column gap-3 h-auto h-lg-100 order-3">
                        {canAccess(role, 'admin') && (
                            <button className="btn btn-outline-primary w-100 py-2 fw-medium text-uppercase text-sm hover-scale transition-all rounded-1 border-opacity-50" onClick={handleOpenAddModal}>
                                <i className="fas fa-plus me-2"></i> Add Camera
                            </button>
                        )}
                        <div className="recent-activity-panel bg-activity rounded-3 border border-dark-subtle d-flex flex-column flex-grow-1 overflow-hidden mt-2" style={{ height: '400px', maxHeight: '100%' }}>
                            <div className="p-3 border-bottom border-secondary bg-dark-header">
                                <h6 className="fw-bold mb-0"><i className="fas fa-history me-2 text-secondary"></i> Recent Activity</h6>
                            </div>
                            <div className="flex-grow-1 overflow-y-auto p-2 custom-scrollbar">
                                {stats.history?.length > 0 ? stats.history.slice().reverse().map((item, idx) => (
                                    <div key={idx} className={`activity-item p-2 mb-2 rounded-1 d-flex align-items-center gap-3 border animate-fade-in cursor-pointer ${item.relation?.includes('Suspect') ? 'border-start border-danger bg-dark ps-3' : 'border-dark-subtle bg-dark-item'}`}
                                        onClick={() => setSelectedLog(enrichLog(item))}>
                                        <div className="avatar-wrapper" style={{ width: 45, height: 45, minWidth: 45 }}>
                                            <img src={item.image?.startsWith('http') ? item.image : `/static/${item.image}`} className="w-100 h-100 rounded-1 object-fit-cover border border-secondary"
                                                onError={(e) => e.target.src = 'https://via.placeholder.com/45?text=?'} alt="" />
                                        </div>
                                        <div className="flex-grow-1 min-w-0">
                                            <div className="d-flex justify-content-between">
                                                <span className={`fw-bold text-sm text-truncate ${item.relation?.includes('Suspect') ? 'text-danger' : 'text-light'}`}>{item.name}</span>
                                                <span className="text-secondary x-small opacity-75">{item.time}</span>
                                            </div>
                                            <div className="d-flex justify-content-between align-items-center mt-1">
                                                <small className="text-secondary text-truncate" style={{ fontSize: '0.75rem', maxWidth: '120px' }}>{item.action}</small>
                                                <span className={`badge rounded-1 ${item.relation?.includes('Suspect') ? 'bg-danger text-white' : 'bg-secondary text-dark'} x-small scale-90`}>{item.relation}</span>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-5 text-secondary opacity-50"><p>No matches yet</p></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showRoiModal && <ROImodal cameraId={roiCameraId} onClose={() => setShowRoiModal(false)} />}

            {selectedLog && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000 }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content bg-panel border-secondary text-light shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold text-uppercase"><i className="fas fa-search me-2 text-primary"></i> Event Details</h5>
                                <button className="btn-close btn-close-white" onClick={() => setSelectedLog(null)}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="row g-0">
                                    <div className="col-lg-8 bg-black d-flex align-items-center justify-content-center border-end border-secondary" style={{ minHeight: '500px' }}>
                                        <img src={selectedLog.image?.startsWith('http') ? selectedLog.image : `/static/${selectedLog.image}`} className="img-fluid" style={{ maxHeight: '70vh', objectFit: 'contain' }} alt="Evidence" />
                                    </div>
                                    <div className="col-lg-4 p-4 d-flex flex-column">
                                        <div className="mb-4">
                                            <div className="small text-secondary text-uppercase mb-1 fw-bold">Detected Entity</div>
                                            <h2 className="fw-bold mb-2 text-white">{selectedLog.name === 'System' ? selectedLog.action : selectedLog.name}</h2>
                                            <div className="d-flex gap-2">
                                                {getSeverityBadge(selectedLog.severity)}
                                                <span className="badge bg-dark border border-secondary text-light">{selectedLog.relation}</span>
                                            </div>
                                        </div>
                                        <div className="rounded bg-dark border border-secondary p-3">
                                            {[['Date', selectedLog.date], ['Time', selectedLog.time], ['Type', selectedLog.type], ['Source', 'Camera (Main)']].map(([k, v]) => (
                                                <div key={k} className="d-flex justify-content-between mb-2 border-bottom border-secondary border-opacity-25 pb-2">
                                                    <span className="text-secondary"><i className={`fas ${k === 'Date' ? 'fa-calendar' : k === 'Time' ? 'fa-clock' : k === 'Type' ? 'fa-tag' : 'fa-camera'} me-2`}></i>{k}</span>
                                                    <span className="fw-bold text-light">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddCameraModal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)', zIndex: 1055 }}>
                    <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
                        <form onSubmit={handleAddCamera} className="modal-content text-white border-secondary shadow-lg" style={{ background: '#0f1117' }}>
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-camera me-2 text-primary"></i>Add Camera</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddCameraModal(false)}></button>
                            </div>
                            <div className="modal-body p-0">
                                {/* Mode tabs */}
                                <div className="d-flex border-bottom border-secondary">
                                    <button type="button"
                                        className={`flex-grow-1 py-3 border-0 fw-bold small ${cameraMode === 'local' ? 'bg-primary text-white' : 'bg-transparent text-secondary'}`}
                                        onClick={() => setCameraMode('local')}>
                                        <i className="fas fa-desktop me-2"></i>Local Webcam
                                    </button>
                                    <button type="button"
                                        className={`flex-grow-1 py-3 border-0 fw-bold small ${cameraMode === 'ip' ? 'bg-primary text-white' : 'bg-transparent text-secondary'}`}
                                        onClick={() => { setCameraMode('ip'); setQrData(null); setIsPollingStatus(false); }}>
                                        <i className="fas fa-network-wired me-2"></i>IP Camera
                                    </button>
                                    <button type="button"
                                        className={`flex-grow-1 py-3 border-0 fw-bold small ${cameraMode === 'qr' ? 'bg-primary text-white' : 'bg-transparent text-secondary'}`}
                                        onClick={() => setCameraMode('qr')}>
                                        <i className="fas fa-qrcode me-2"></i>QR Connect
                                    </button>
                                </div>

                                <div className="p-4">
                                    {cameraMode === 'local' ? (
                                        <>
                                            {availableCameras.length > 0 ? (
                                                <>
                                                    <div className="mb-3">
                                                        <label className="form-label text-secondary small">Select Device</label>
                                                        <select className="form-select bg-black text-white border-secondary" value={newCamData.id}
                                                            onChange={e => { const s = availableCameras.find(c => c.id == e.target.value); setNewCamData({ id: e.target.value, label: s ? s.label : `Camera ${e.target.value}` }); }}>
                                                            {availableCameras.map(cam => <option key={cam.id} value={cam.id}>{cam.label} (ID: {cam.id})</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="form-label text-secondary small">Camera Label</label>
                                                        <input type="text" className="form-control bg-black text-white border-secondary" placeholder="e.g. Entrance Hall" value={newCamData.label} onChange={e => setNewCamData({ ...newCamData, label: e.target.value })} />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="alert alert-warning d-flex align-items-center">
                                                    <i className="fas fa-exclamation-triangle me-3"></i>
                                                    <div>No new local cameras detected. Try the <strong>Mobile / IP Camera</strong> tab.</div>
                                                </div>
                                            )}
                                        </>
                                    ) : cameraMode === 'ip' ? (
                                        <>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Stream URL <span className="text-danger">*</span></label>
                                                <input type="text" className="form-control bg-black text-white border-secondary"
                                                    placeholder="http://192.168.x.x:8080/video or rtsp://..."
                                                    value={ipCamData.url}
                                                    onChange={e => setIpCamData({ ...ipCamData, url: e.target.value })} required />
                                                <div className="form-text text-secondary mt-1">Enter the stream URL from your mobile camera app.</div>
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Camera Label</label>
                                                <input type="text" className="form-control bg-black text-white border-secondary"
                                                    placeholder="e.g. Front Door Mobile"
                                                    value={ipCamData.label}
                                                    onChange={e => setIpCamData({ ...ipCamData, label: e.target.value })} />
                                            </div>
                                            {/* App instructions */}
                                            <div className="rounded-3 p-3 border border-secondary border-opacity-50" style={{ background: '#1a1d26', fontSize: '0.8rem' }}>
                                                <div className="fw-bold text-info mb-2"><i className="fas fa-info-circle me-2"></i>How to connect your phone</div>
                                                <div className="text-secondary">
                                                    <p className="mb-2">📱 <strong className="text-light">Android:</strong> Install <strong>"IP Webcam"</strong> or <strong>"DroidCam"</strong> → Start server → Enter the URL shown (e.g. <code>http://192.168.1.5:8080/video</code>)</p>
                                                    <p className="mb-2">🍎 <strong className="text-light">iPhone:</strong> Install <strong>"EpocCam"</strong> or <strong>"Camo"</strong> → Connect via WiFi → Use the displayed stream URL</p>
                                                    <p className="mb-0">🔗 <strong className="text-light">RTSP cameras:</strong> Use format <code>rtsp://user:pass@IP:port/stream</code></p>
                                                </div>
                                                <div className="mt-2 text-warning small"><i className="fas fa-wifi me-1"></i>Phone and PC must be on the same WiFi network.</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center">
                                            {!qrData ? (
                                                <div className="p-2">
                                                    <div className="mb-4">
                                                        <label className="form-label text-secondary small">Camera Label</label>
                                                        <input type="text" className="form-control bg-black text-white border-secondary" 
                                                            value={qrLabel} onChange={e => setQrLabel(e.target.value)} />
                                                    </div>
                                                    <button type="button" className="btn btn-primary w-100 py-3" onClick={handleGenerateQr} disabled={addingCam}>
                                                        {addingCam ? <i className="fas fa-spinner fa-spin me-2"></i> : <i className="fas fa-magic me-2"></i>}
                                                        Generate Connection QR
                                                    </button>
                                                    <p className="mt-3 text-secondary small">Scan the QR code with your phone to turn it into a wireless security camera instantly.</p>
                                                </div>
                                            ) : (
                                                <div className="animate-fade-in">
                                                    <div className="bg-white p-3 rounded-4 d-inline-block shadow-lg mb-3">
                                                        <img src={qrData.qr_image} alt="QR Code" style={{ width: 220, height: 220 }} />
                                                    </div>
                                                    <h5 className="fw-bold text-primary mb-2">Scan & Connect</h5>
                                                    <p className="text-secondary small mb-4">Point your phone's camera at this QR code.<br/>It will open a secure streaming page.</p>
                                                    
                                                    <div className="d-flex align-items-center justify-content-center gap-2 text-warning small animate-pulse">
                                                        <div className="spinner-grow spinner-grow-sm" role="status"></div>
                                                        <span>Waiting for mobile connection...</span>
                                                    </div>
                                                    
                                                    <button type="button" className="btn btn-sm btn-link text-secondary mt-4" onClick={() => setQrData(null)}>
                                                        Cancel & Reset
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top border-secondary">
                                <button type="button" className="btn btn-outline-light" onClick={() => setShowAddCameraModal(false)} disabled={addingCam}>Cancel</button>
                                {cameraMode !== 'qr' && (
                                    <button type="submit" className="btn btn-primary px-4" disabled={addingCam || (cameraMode === 'local' && availableCameras.length === 0)}>
                                        {addingCam ? <><i className="fas fa-spinner fa-spin me-2"></i>Connecting...</> : <><i className="fas fa-plug me-2"></i>Connect Camera</>}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Dashboard Shell ───────────────────────────────────────────────────
const Dashboard = ({ user, onLogout }) => {
    const role = user?.role || 'admin';
    const defaultView = getDefaultView(role);
    const [activeView, setActiveView] = useState(defaultView);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Guard navigation — redirect unauthorized views
    const navigate = (view) => {
        if (canAccess(role, view)) setActiveView(view);
    };

    const ROLE_BADGE = { admin: '#7c3aed', manager: '#0ea5e9', owner: '#f59e0b', security_guard: '#10b981' };

    return (
        <div className="d-flex h-100 bg-dark-theme text-light font-sans overflow-hidden position-relative">
            <Sidebar activePage={activeView} onNavigate={navigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

            <div className="flex-grow-1 d-flex flex-column overflow-hidden position-relative w-100">
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom border-dark-subtle bg-header z-10">
                    <div className="d-flex align-items-center gap-3">
                        <button className="btn btn-link text-secondary p-0 me-2" onClick={() => setSidebarOpen(true)}>
                            <i className="fas fa-bars fa-lg"></i>
                        </button>
                        <div className="logo-box bg-primary text-white p-2 rounded shadow-lg glow-primary">
                            <i className="fas fa-shield-alt fa-lg"></i>
                        </div>
                        <div>
                            <h5 className="fw-bolder mb-0 text-uppercase tracking-widest d-none d-md-block text-white" style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '2px' }}>Smart AutoSecure Vision</h5>
                            <div className="d-flex align-items-center gap-2 text-secondary" style={{ fontSize: '0.7rem' }}>
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 animate-pulse rounded-pill">LIVE MONITORING</span>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-3 text-sm text-secondary">
                        <div className="d-none d-md-flex gap-3 align-items-center">
                            {/* Role pill */}
                            <span className="badge rounded-pill px-3 py-2 small" style={{ background: (ROLE_BADGE[role] || '#6b7280') + '25', color: ROLE_BADGE[role] || '#6b7280', border: `1px solid ${(ROLE_BADGE[role] || '#6b7280')}50`, fontSize: '0.7rem' }}>
                                <i className="fas fa-user-tag me-1"></i>{role.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-secondary small d-none d-lg-inline text-truncate" style={{ maxWidth: 160 }}>{user?.name}</span>
                            <div className="vr mx-2 bg-secondary opacity-25"></div>
                            <button className="btn btn-link p-0 text-secondary text-decoration-none hover-scale" onClick={() => setTheme(p => p === 'dark' ? 'light' : 'dark')} title="Toggle theme">
                                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} fa-lg`}></i>
                            </button>
                            {canAccess(role, 'about') && <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-primary small" onClick={() => navigate('about')}>About</button>}
                            {canAccess(role, 'help') && <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-primary small" onClick={() => navigate('help')}>Help</button>}
                            <button className="btn btn-link p-0 text-danger text-decoration-none hover-text-primary small" onClick={onLogout}>
                                <i className="fas fa-sign-out-alt me-1"></i>Logout
                            </button>
                        </div>
                        <div className="border-start border-dark-subtle ps-3 text-light fw-bold font-monospace small">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Content Views — role-guarded */}
                {activeView === 'dashboard' && canAccess(role, 'dashboard') && <DashboardContent onNavigate={navigate} user={user} />}
                {activeView === 'logs' && canAccess(role, 'logs') && <Logs user={user} />}
                {activeView === 'contacts' && canAccess(role, 'contacts') && <Contacts user={user} />}
                {activeView === 'admin' && canAccess(role, 'admin') && <Admin user={user} />}
                {activeView === 'users' && canAccess(role, 'users') && <UserManagement user={user} />}
                {activeView === 'settings' && canAccess(role, 'settings') && <Settings />}
                {activeView === 'help' && canAccess(role, 'help') && <Help />}
                {activeView === 'about' && canAccess(role, 'about') && <About />}

                {/* Access Denied fallback */}
                {!canAccess(role, activeView) && (
                    <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary">
                        <i className="fas fa-lock fa-4x mb-4 text-danger opacity-50"></i>
                        <h4 className="text-danger fw-bold">Access Restricted</h4>
                        <p>Your role <strong>({role.replace('_', ' ')})</strong> does not have permission to view this page.</p>
                        <button className="btn btn-outline-primary mt-3" onClick={() => navigate(defaultView)}>Go to Home</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
