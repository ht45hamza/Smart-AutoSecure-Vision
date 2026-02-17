import React, { useState, useEffect, useRef } from 'react';
import { fetchAddedCameras, setMainCamera, fetchStats, fetchEmergencyStatus, addCamera, fetchCameras } from '../api';
import ROImodal from './ROImodal';

const Dashboard = () => {
    const [cameras, setCameras] = useState([]);
    const [mainCameraId, setMainCameraId] = useState(null);
    const [stats, setStats] = useState({ known: 0, unknown: 0, suspects: 0, history: [] });
    const [emergency, setEmergency] = useState({ active: false });
    const [showRoiModal, setShowRoiModal] = useState(false);
    const [roiCameraId, setRoiCameraId] = useState(null);

    // Add Camera State
    const [showAddCameraModal, setShowAddCameraModal] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [newCamData, setNewCamData] = useState({ id: '', label: '' });

    const openRoi = (id) => {
        setRoiCameraId(id);
        setShowRoiModal(true);
    };

    const handleOpenAddModal = async () => {
        try {
            const avail = await fetchCameras(); // Fetch available cams from backend
            setAvailableCameras(avail);
            if (avail.length > 0) {
                setNewCamData({ id: avail[0].id, label: avail[0].label });
            }
            setShowAddCameraModal(true);
        } catch (e) {
            alert("Error fetching available cameras");
        }
    };

    const handleAddCamera = async (e) => {
        e.preventDefault();
        try {
            await addCamera(parseInt(newCamData.id), newCamData.label || `Camera ${newCamData.id}`);
            setShowAddCameraModal(false);
            setNewCamData({ id: '', label: '' });
            loadCameras();
            alert("Camera Added Successfully");
        } catch (error) {
            alert("Failed to add camera. Ensure ID is unique and valid.");
        }
    };

    // Camera Loading
    useEffect(() => {
        loadCameras();
        const interval = setInterval(loadStats, 2000);
        const emergInterval = setInterval(checkEmergency, 1000);
        return () => {
            clearInterval(interval);
            clearInterval(emergInterval);
        };
    }, []);

    const loadCameras = async () => {
        try {
            const data = await fetchAddedCameras();
            setCameras(data);
            const main = data.find(c => c.main);
            if (main) {
                setMainCameraId(main.id);
            } else if (data.length > 0) {
                // Determine implicit main if none set explicitly
                setMainCameraId(data[0].id);
            }
        } catch (e) {
            console.error("Failed to load cameras", e);
        }
    };

    const loadStats = async () => {
        try {
            const data = await fetchStats();
            setStats(data);
        } catch (e) { }
    };

    const checkEmergency = async () => {
        try {
            const data = await fetchEmergencyStatus();
            setEmergency(data);
        } catch (e) { }
    };

    const handleSetMain = async (id) => {
        await setMainCamera(id);
        setMainCameraId(id);
        loadCameras(); // Refresh list to update main status
    };

    return (
        <div className="d-flex flex-column h-100 bg-dark-theme text-light font-sans">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center px-4 py-3 border-bottom border-dark-subtle bg-header">
                <div className="d-flex align-items-center gap-3">
                    <div className="logo-box bg-primary text-white p-2 rounded">
                        <i className="fas fa-shield-alt fa-lg"></i>
                    </div>
                    <div>
                        <h5 className="fw-bold mb-0 text-uppercase tracking-wider">Smart AutoSecure Vision</h5>
                        <div className="d-flex align-items-center gap-2 text-secondary" style={{ fontSize: '0.75rem' }}>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-0.5">LIVE DASHBOARD</span>
                            <span>Real-time surveillance & threat monitoring</span>
                        </div>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-4 text-sm text-secondary">
                    <div className="d-flex gap-3">
                        <a href="#" className="text-secondary text-decoration-none hover-text-white"><i className="fas fa-info-circle me-1"></i> About</a>
                        <a href="#" className="text-secondary text-decoration-none hover-text-white"><i className="fas fa-question-circle me-1"></i> Help</a>
                        <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-white" onClick={() => window.showComponent('login')}><i className="fas fa-sign-in-alt me-1"></i> Login</button>
                    </div>
                    <div className="border-start border-secondary ps-3 text-white fw-bold font-monospace">
                        <i className="fas fa-clock me-2 text-primary"></i>
                        {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>

            <div className="container-fluid p-4 flex-grow-1 overflow-hidden">
                <div className="row g-4 h-100">
                    {/* LEFT SIDEBAR: STATS */}
                    <div className="col-lg-2 d-flex flex-column gap-3">
                        {/* Known Persons - Green */}
                        <div className="stat-card border-green">
                            <h2 className="text-green fw-bold mb-0">{stats.known}</h2>
                            <p className="text-secondary small text-uppercase mb-0">Known Persons</p>
                            <div className="stat-icon text-green"><i className="fas fa-user-check"></i></div>
                        </div>

                        {/* Unknown Persons - Yellow */}
                        <div className="stat-card border-yellow">
                            <h2 className="text-yellow fw-bold mb-0">{stats.unknown}</h2>
                            <p className="text-secondary small text-uppercase mb-0">Unknown Persons</p>
                            <div className="stat-icon text-yellow"><i className="fas fa-user-secret"></i></div>
                        </div>

                        {/* Suspects - Red */}
                        <div className="stat-card border-red">
                            <h2 className="text-red fw-bold mb-0">{stats.suspects}</h2>
                            <p className="text-secondary small text-uppercase mb-0">Suspects Detected</p>
                            <div className="stat-icon text-red"><i className="fas fa-exclamation-triangle"></i></div>
                        </div>

                        {/* Total Events - Blue */}
                        <div className="stat-card border-blue flex-grow-1 d-flex flex-column justify-content-center">
                            <h2 className="text-blue fw-bold mb-0 display-5">{stats.history ? stats.history.length : 0}</h2>
                            <p className="text-secondary small text-uppercase mb-0">Total Events</p>
                            <div className="stat-icon text-blue bottom-right"><i className="fas fa-chart-bar"></i></div>
                        </div>
                    </div>

                    {/* CENTER: VIDEO FEEDS */}
                    <div className="col-lg-7 d-flex flex-column gap-3">
                        {/* Main Feed */}
                        <div className="main-video-container flex-grow-1 position-relative bg-black rounded-3 border border-dark-subtle overflow-hidden shadow-lg">
                            {mainCameraId !== null ? (
                                <>
                                    <img
                                        key={mainCameraId}
                                        src={`/video_feed/${mainCameraId}/?t=${Date.now()}`}
                                        className="w-100 h-100 object-fit-contain"
                                        alt="Main Feed"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/800x600?text=Signal+Lost'; }}
                                    />
                                    {/* Overlays */}
                                    <div className="position-absolute top-0 start-0 m-3 px-3 py-1 bg-danger text-white rounded-pill small fw-bold shadow-sm animate-pulse">
                                        <span className="blink-dot bg-white me-2"></span>LIVE FEED
                                    </div>
                                    <button
                                        className="btn btn-dark btn-sm position-absolute top-0 end-0 m-3 border-secondary"
                                        onClick={() => openRoi(mainCameraId)}
                                    >
                                        <i className="fas fa-crop-alt me-2"></i> Edit ROI
                                    </button>
                                    {/* ROI Guidelines Simulation */}
                                    <div className="roi-overlay"></div>
                                </>
                            ) : (
                                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-secondary">
                                    <i className="fas fa-video-slash fa-3x mb-3 opacity-50"></i>
                                    <h6>NO SIGNAL</h6>
                                </div>
                            )}
                        </div>

                        {/* Camera Grid */}
                        <div className="camera-grid-row d-flex gap-3 overflow-x-auto pb-2" style={{ height: '140px' }}>
                            {cameras.map(cam => (
                                <div
                                    key={cam.id}
                                    className={`camera-thumbnail position-relative rounded-3 overflow-hidden flex-shrink-0 cursor-pointer ${mainCameraId === cam.id ? 'active-cam' : ''}`}
                                    style={{ width: '200px', background: '#000' }}
                                    onClick={() => handleSetMain(cam.id)}
                                >
                                    <img
                                        src={`/video_feed/${cam.id}/?t=${Date.now()}`}
                                        className="w-100 h-100 object-fit-cover opacity-75 hover-opacity-100 transition-all"
                                    />
                                    <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-to-t from-black to-transparent">
                                        <span className={`badge ${mainCameraId === cam.id ? 'bg-primary' : 'bg-secondary'} small`}>{cam.label}</span>
                                    </div>
                                    {mainCameraId === cam.id && (
                                        <div className="position-absolute top-0 end-0 m-2 text-primary"><i className="fas fa-check-circle"></i></div>
                                    )}
                                </div>
                            ))}
                            {/* Add Camera Placeholder if empty */}
                            {cameras.length === 0 && (
                                <div className="d-flex align-items-center justify-content-center border border-secondary border-dashed rounded-3 text-secondary small w-100">
                                    No Cameras Detected
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT SIDEBAR: ACTIONS & LOGS */}
                    <div className="col-lg-3 d-flex flex-column gap-3">
                        <button className="btn btn-primary w-100 py-3 fw-bold text-uppercase shadow-primary hover-scale" onClick={handleOpenAddModal}>
                            <i className="fas fa-plus-circle me-2"></i> Add Camera
                        </button>
                        <button className="btn btn-outline-light w-100 py-2 border-secondary hover-bg-light-dark" onClick={() => window.showComponent('admin')}>
                            <i className="fas fa-cog me-2"></i> Admin Panel
                        </button>

                        <div className="recent-activity-panel bg-panel rounded-3 border border-dark-subtle d-flex flex-column flex-grow-1 overflow-hidden mt-2">
                            <div className="p-3 border-bottom border-secondary bg-dark-header">
                                <h6 className="fw-bold mb-0"><i className="fas fa-history me-2 text-secondary"></i> Recent Activity</h6>
                            </div>
                            <div className="flex-grow-1 overflow-y-auto p-2 scrollbar-thin">
                                {stats.history && stats.history.length > 0 ? (
                                    stats.history.slice().reverse().map((item, idx) => (
                                        <div key={idx} className={`activity-item p-2 mb-2 rounded-3 d-flex align-items-center gap-3 border ${item.relation?.includes('Suspect') ? 'border-danger bg-danger-subtle' : 'border-dark-subtle bg-dark-item'}`}>
                                            <div className="avatar-wrapper" style={{ width: 45, height: 45 }}>
                                                <img
                                                    src={item.image?.startsWith('http') ? item.image : `/static/${item.image}`}
                                                    className="w-100 h-100 rounded-circle object-fit-cover border border-secondary"
                                                    onError={(e) => e.target.src = 'https://via.placeholder.com/45?text=?'}
                                                />
                                            </div>
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="d-flex justify-content-between">
                                                    <span className="fw-bold text-sm text-white text-truncate">{item.name}</span>
                                                    <span className="text-secondary x-small opacity-75">{item.time}</span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mt-1">
                                                    <small className="text-secondary text-truncate" style={{ fontSize: '0.75rem', maxWidth: '120px' }}>{item.action}</small>
                                                    <span className={`badge rounded-pill ${item.relation?.includes('Suspect') ? 'bg-danger text-white' : 'bg-secondary text-dark'} x-small scale-90`}>
                                                        {item.relation}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-5 text-secondary opacity-50">
                                        <p>No matches yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {showRoiModal && (
                    <ROImodal
                        cameraId={roiCameraId}
                        onClose={() => setShowRoiModal(false)}
                    />
                )}

                {/* Add Camera Modal */}
                {showAddCameraModal && (
                    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)' }}>
                        <div className="modal-dialog modal-dialog-centered">
                            <form onSubmit={handleAddCamera} className="modal-content bg-dark text-white border-secondary shadow-lg">
                                <div className="modal-header border-bottom border-secondary">
                                    <h5 className="modal-title">Add New Camera</h5>
                                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddCameraModal(false)}></button>
                                </div>
                                <div className="modal-body">
                                    {availableCameras.length > 0 ? (
                                        <>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Select Device</label>
                                                <select
                                                    className="form-select bg-black text-white border-secondary"
                                                    value={newCamData.id}
                                                    onChange={e => {
                                                        const selected = availableCameras.find(c => c.id == e.target.value);
                                                        setNewCamData({ id: e.target.value, label: selected ? selected.label : `Camera ${e.target.value}` });
                                                    }}
                                                >
                                                    {availableCameras.map(cam => (
                                                        <option key={cam.id} value={cam.id}>{cam.label} (ID: {cam.id})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Camera Label</label>
                                                <input
                                                    type="text"
                                                    className="form-control bg-black text-white border-secondary"
                                                    placeholder="e.g. Entrance Hall"
                                                    value={newCamData.label}
                                                    onChange={e => setNewCamData({ ...newCamData, label: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="alert alert-warning d-flex align-items-center">
                                            <i className="fas fa-exclamation-triangle me-3"></i>
                                            <div>No new cameras detected on the system.</div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer border-top border-secondary">
                                    <button type="button" className="btn btn-outline-light" onClick={() => setShowAddCameraModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary px-4" disabled={availableCameras.length === 0}>Add Camera</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
