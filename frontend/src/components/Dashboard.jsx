import React, { useState, useEffect, useRef } from 'react';
import { fetchAddedCameras, setMainCamera, fetchStats, fetchEmergencyStatus, addCamera, fetchCameras } from '../api';
import ROImodal from './ROImodal';
import Sidebar from './Sidebar';
import Logs from './Logs';
import Contacts from './Contacts';
import Admin from './Admin';
import Help from './Help';
import About from './About';
import Settings from './Settings';

const DashboardContent = ({ onNavigate }) => {
    const [cameras, setCameras] = useState([]);
    const [mainCameraId, setMainCameraId] = useState(null);
    const [stats, setStats] = useState({ known: 0, unknown: 0, suspects: 0, history: [] });
    const [emergency, setEmergency] = useState({ active: false });

    // Add Camera State
    const [showAddCameraModal, setShowAddCameraModal] = useState(false);
    const [availableCameras, setAvailableCameras] = useState([]);
    const [newCamData, setNewCamData] = useState({ id: '', label: '' });

    // ROI State
    const [showRoiModal, setShowRoiModal] = useState(false);
    const [roiCameraId, setRoiCameraId] = useState(null);

    // Log Details Modal State
    const [selectedLog, setSelectedLog] = useState(null);

    const getSeverityBadge = (level) => {
        switch (level) {
            case 'Critical': return <span className="badge bg-danger">CRITICAL</span>;
            case 'High': return <span className="badge bg-warning text-dark">HIGH</span>;
            case 'Medium': return <span className="badge bg-info text-dark">MEDIUM</span>;
            default: return <span className="badge bg-secondary">LOW</span>;
        }
    };

    const enrichLog = (item) => {
        let severity = 'Low';
        let type = 'Info';
        if (item.name === 'System') {
            if (item.action && item.action.toLowerCase().includes('weapon')) {
                severity = 'Critical';
                type = 'Weapon';
            } else {
                severity = 'Medium';
                type = 'System';
            }
        } else {
            if (item.relation === 'Suspect') {
                severity = 'High';
                type = 'Person';
            } else if (item.relation === 'Visual') {
                severity = 'Medium';
                type = 'Person';
            }
        }
        return { ...item, severity, type };
    };

    const openRoi = (id) => {
        setRoiCameraId(id);
        setShowRoiModal(true);
    };

    const handleOpenAddModal = async () => {
        try {
            const avail = await fetchCameras();
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
        loadCameras();
    };

    return (
        <div className="d-flex flex-column h-100 bg-dark-theme text-light font-sans animate-fade-in">
            {/* Main Content Area */}
            <div className="container-fluid p-4 flex-grow-1 overflow-hidden">
                <div className="row g-4 h-lg-100 overflow-y-auto overflow-lg-hidden pb-5 pb-lg-0">

                    {/* LEFT: STATS */}
                    <div className="col-12 col-md-12 col-lg-3 col-xl-2 order-2 order-lg-1 h-auto h-lg-100 overflow-y-auto custom-scrollbar">
                        <div className="row g-3 flex-lg-column h-100">
                            {/* Stats Cards */}
                            <div className="col-6 col-md-3 col-lg-12">
                                <div className="stat-card-enhanced border-start border-success shadow-sm h-100 d-flex flex-column justify-content-between" style={{ minHeight: '130px' }}>
                                    <div>
                                        <h2 className="text-light fw-bold mb-0 display-6">{stats.known}</h2>
                                        <p className="text-success small text-uppercase mb-0 tracking-wider font-monospace">Known</p>
                                    </div>
                                    <i className="fas fa-user-check stat-icon-bg text-success display-4 opacity-10 position-absolute bottom-0 end-0 m-2"></i>
                                </div>
                            </div>
                            <div className="col-6 col-md-3 col-lg-12">
                                <div className="stat-card-enhanced border-start border-warning shadow-sm h-100 d-flex flex-column justify-content-between" style={{ minHeight: '130px' }}>
                                    <div>
                                        <h2 className="text-light fw-bold mb-0 display-6">{stats.unknown}</h2>
                                        <p className="text-warning small text-uppercase mb-0 tracking-wider font-monospace">Unknown</p>
                                    </div>
                                    <i className="fas fa-user-secret stat-icon-bg text-warning display-4 opacity-10 position-absolute bottom-0 end-0 m-2"></i>
                                </div>
                            </div>
                            <div className="col-6 col-md-3 col-lg-12">
                                <div className="stat-card-enhanced border-start border-danger shadow-lg bg-danger-subtle h-100 d-flex flex-column justify-content-between" style={{ minHeight: '130px' }}>
                                    <div>
                                        <h2 className="text-light fw-bold mb-0 display-6">{stats.suspects}</h2>
                                        <p className="text-danger small text-uppercase mb-0 tracking-wider font-monospace">Suspects</p>
                                    </div>
                                    <div className="spinner-grow text-danger spinner-grow-sm position-absolute top-0 end-0 m-2" role="status"></div>
                                    <i className="fas fa-exclamation-triangle stat-icon-bg text-danger display-4 opacity-10 position-absolute bottom-0 end-0 m-2"></i>
                                </div>
                            </div>
                            <div className="col-6 col-md-3 col-lg-12 flex-lg-grow-1">
                                <div className="stat-card-enhanced border-start border-primary shadow-sm h-100 d-flex flex-column justify-content-center position-relative" style={{ minHeight: '130px' }}>
                                    <h2 className="text-light fw-bold mb-0 display-4">{stats.history ? stats.history.length : 0}</h2>
                                    <p className="text-primary small text-uppercase mb-0 tracking-wider font-monospace">Events</p>
                                    <i className="fas fa-chart-bar stat-icon-bg text-primary display-2 opacity-10 position-absolute bottom-0 end-0 m-2"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CENTER: VIDEO */}
                    <div className="col-12 col-md-12 col-lg-6 col-xl-7 d-flex flex-column gap-3 order-1 order-lg-2" style={{ minHeight: '400px' }}>
                        <div className="main-video-container flex-grow-1 position-relative bg-black rounded-3 border border-dark-subtle overflow-hidden d-flex align-items-center justify-content-center" style={{ minHeight: '300px' }}>
                            <div className="ratio ratio-16x9 w-100 h-100" style={{ maxHeight: '100%' }}>
                                {mainCameraId !== null ? (
                                    <>
                                        <img
                                            key={mainCameraId}
                                            src={`/video_feed/${mainCameraId}/?t=${Date.now()}`}
                                            className="w-100 h-100 object-fit-contain"
                                            alt="Main Feed"
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/800x600?text=Signal+Lost'; }}
                                        />
                                        <div className="position-absolute top-0 start-0 m-3 px-3 py-1 bg-danger text-white rounded-1 small fw-bold z-10" style={{ height: 'fit-content', width: 'fit-content' }}>
                                            <span className="blink-dot bg-white me-2"></span>LIVE
                                        </div>
                                        <button
                                            className="btn btn-primary btn-sm position-absolute top-0 end-0 m-3 z-20 d-flex align-items-center gap-2 border-0 shadow-none op-90 hover-op-100"
                                            style={{ height: 'fit-content', width: 'fit-content' }}
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); openRoi(mainCameraId); }}
                                            title="Edit Region of Interest"
                                        >
                                            <i className="fas fa-crop-alt"></i> Set ROI
                                        </button>
                                        <div className="roi-overlay"></div>
                                    </>
                                ) : (
                                    <div className="d-flex flex-column align-items-center justify-content-center text-secondary w-100 h-100">
                                        <i className="fas fa-video-slash fa-3x mb-3 opacity-50"></i>
                                        <h6>NO SIGNAL</h6>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Camera Grid */}
                        <div className="camera-grid-row d-flex gap-3 overflow-x-auto pb-2 custom-scrollbar" style={{ height: '120px' }}>
                            {cameras.map(cam => (
                                <div
                                    key={cam.id}
                                    className={`camera-thumbnail position-relative rounded-3 overflow-hidden flex-shrink-0 cursor-pointer ${mainCameraId === cam.id ? 'active-cam border border-primary border-2' : 'border border-secondary'}`}
                                    style={{ width: '180px', background: '#000' }}
                                    onClick={() => handleSetMain(cam.id)}
                                >
                                    <img
                                        src={`/video_feed/${cam.id}/?t=${Date.now()}`}
                                        className="w-100 h-100 object-fit-cover opacity-75 hover-opacity-100 transition-all"
                                    />
                                    <div className="position-absolute bottom-0 start-0 w-100 p-2 bg-gradient-to-t from-black to-transparent">
                                        <span className={`badge ${mainCameraId === cam.id ? 'bg-primary' : 'bg-secondary'} small rounded-1 fw-normal`}>{cam.label}</span>
                                    </div>
                                </div>
                            ))}
                            {cameras.length === 0 && (
                                <div className="d-flex align-items-center justify-content-center border border-secondary border-dashed rounded-3 text-secondary small w-100">
                                    No Cameras Detected
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: LOGS */}
                    <div className="col-12 col-md-12 col-lg-3 col-xl-3 d-flex flex-column gap-3 h-auto h-lg-100 order-3">
                        <button className="btn btn-outline-primary w-100 py-2 fw-medium text-uppercase text-sm hover-scale transition-all rounded-1 border-opacity-50" onClick={handleOpenAddModal}>
                            <i className="fas fa-plus me-2"></i> Add Camera
                        </button>
                        <div className="recent-activity-panel bg-activity rounded-3 border border-dark-subtle d-flex flex-column flex-grow-1 overflow-hidden mt-2" style={{ height: '400px', maxHeight: '100%' }}>
                            <div className="p-3 border-bottom border-secondary bg-dark-header">
                                <h6 className="fw-bold mb-0 text-heading"><i className="fas fa-history me-2 text-secondary"></i> Recent Activity</h6>
                            </div>
                            <div className="flex-grow-1 overflow-y-auto p-2 custom-scrollbar">
                                {stats.history && stats.history.length > 0 ? (
                                    stats.history.slice().reverse().map((item, idx) => (
                                        <div
                                            key={idx}
                                            className={`activity-item p-2 mb-2 rounded-1 d-flex align-items-center gap-3 border animate-fade-in cursor-pointer ${item.relation?.includes('Suspect') ? 'border-start border-danger bg-dark ps-3' : 'border-dark-subtle bg-dark-item'}`}
                                            onClick={() => setSelectedLog(enrichLog(item))}
                                        >
                                            <div className="avatar-wrapper" style={{ width: 45, height: 45, minWidth: 45 }}>
                                                <img
                                                    src={item.image?.startsWith('http') ? item.image : `/static/${item.image}`}
                                                    className="w-100 h-100 rounded-1 object-fit-cover border border-secondary"
                                                    onError={(e) => e.target.src = 'https://via.placeholder.com/45?text=?'}
                                                />
                                            </div>
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="d-flex justify-content-between">
                                                    <span className={`fw-bold text-sm text-truncate ${item.relation?.includes('Suspect') ? 'text-danger' : 'text-light'}`}>{item.name}</span>
                                                    <span className="text-secondary x-small opacity-75">{item.time}</span>
                                                </div>
                                                <div className="d-flex justify-content-between align-items-center mt-1">
                                                    <small className="text-secondary text-truncate" style={{ fontSize: '0.75rem', maxWidth: '120px' }}>{item.action}</small>
                                                    <span className={`badge rounded-1 ${item.relation?.includes('Suspect') ? 'bg-danger text-white' : 'bg-secondary text-dark'} x-small scale-90`}>
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
            </div>

            {/* Modals */}
            {showRoiModal && (
                <ROImodal
                    cameraId={roiCameraId}
                    onClose={() => setShowRoiModal(false)}
                />
            )}

            {selectedLog && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000 }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content bg-panel border-secondary text-light shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold text-uppercase">
                                    <i className="fas fa-search me-2 text-primary"></i> Event Details
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setSelectedLog(null)}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="row g-0">
                                    <div className="col-lg-8 bg-black d-flex align-items-center justify-content-center border-end border-secondary" style={{ minHeight: '500px' }}>
                                        <img
                                            src={selectedLog.image && selectedLog.image.startsWith('http') ? selectedLog.image : `/static/${selectedLog.image}`}
                                            className="img-fluid"
                                            style={{ maxHeight: '70vh', objectFit: 'contain' }}
                                            alt="Evidence"
                                        />
                                    </div>
                                    <div className="col-lg-4 p-4 d-flex flex-column">
                                        <div className="mb-4">
                                            <div className="small text-secondary text-uppercase mb-1 fw-bold tracking-wide">Detected Threat / Entity</div>
                                            <h2 className="fw-bold mb-2 text-white">{selectedLog.name === 'System' ? selectedLog.action : selectedLog.name}</h2>
                                            <div className="d-flex gap-2">
                                                {getSeverityBadge(selectedLog.severity)}
                                                <span className="badge bg-dark border border-secondary text-light">{selectedLog.relation}</span>
                                            </div>
                                        </div>
                                        <div className="mb-4 rounded bg-dark border border-secondary p-3 shadow-inner">
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary border-opacity-25 pb-2">
                                                <span className="text-secondary"><i className="fas fa-calendar me-2"></i> Date</span>
                                                <span className="fw-bold text-light custom-font-mono">{selectedLog.date}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary border-opacity-25 pb-2">
                                                <span className="text-secondary"><i className="fas fa-clock me-2"></i> Time</span>
                                                <span className="fw-bold text-light custom-font-mono">{selectedLog.time}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary border-opacity-25 pb-2">
                                                <span className="text-secondary"><i className="fas fa-tag me-2"></i> Type</span>
                                                <span>{selectedLog.type}</span>
                                            </div>
                                            <div className="d-flex justify-content-between">
                                                <span className="text-secondary"><i className="fas fa-camera me-2"></i> Source</span>
                                                <span>Camera 01 (Main)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddCameraModal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={handleAddCamera} className="modal-content bg-panel text-white border-secondary shadow-lg">
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
    );
};

const Dashboard = () => {
    const [activeView, setActiveView] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    return (
        <div className="d-flex h-100 bg-dark-theme text-light font-sans overflow-hidden position-relative">
            <Sidebar
                activePage={activeView}
                onNavigate={setActiveView}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <div className="flex-grow-1 d-flex flex-column overflow-hidden position-relative w-100">
                {/* Header with Toggle */}
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
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-0.5 animate-pulse rounded-pill">LIVE MONITORING</span>
                            </div>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-4 text-sm text-secondary">
                        <div className="d-none d-md-flex gap-3 align-items-center">
                            <button
                                className="btn btn-link p-0 text-secondary text-decoration-none hover-scale"
                                onClick={toggleTheme}
                                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                            >
                                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} fa-lg`}></i>
                            </button>
                            <div className="vr mx-2 bg-secondary opacity-25"></div>
                            <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-primary small" onClick={() => setActiveView('about')}>About</button>
                            <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-primary small" onClick={() => setActiveView('help')}>Help</button>
                            <button className="btn btn-link p-0 text-secondary text-decoration-none hover-text-primary small" onClick={() => window.showComponent ? window.showComponent('login') : window.location.href = '/login'}>Logout</button>
                        </div>
                        <div className="border-start border-dark-subtle ps-3 text-light fw-bold font-monospace small">
                            {new Date().toLocaleTimeString()}
                        </div>
                    </div>
                </div>

                {/* Content Views */}
                {activeView === 'dashboard' && <DashboardContent onNavigate={setActiveView} />}
                {activeView === 'logs' && <Logs />}
                {activeView === 'contacts' && <Contacts />}
                {activeView === 'admin' && <Admin />}
                {activeView === 'settings' && <Settings />}
                {activeView === 'help' && <Help />}
                {activeView === 'about' && <About />}
            </div>
        </div>
    );
};

export default Dashboard;
