import React from 'react';

const Sidebar = ({ activePage, onNavigate, isOpen, onClose }) => {
    return (
        <>
            {/* Overlay */}
            <div className={`sidebar-overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>

            {/* Drawer */}
            <div className={`d-flex flex-column flex-shrink-0 bg-header border-end border-secondary custom-scrollbar overflow-y-auto font-sans sidebar-drawer ${isOpen ? 'open' : ''}`}>
                <div className="d-flex align-items-center justify-content-between p-4 border-bottom border-dark-subtle">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="d-flex align-items-center text-light text-decoration-none bg-transparent border-0"
                    >
                        <div className="bg-primary rounded p-1 me-3 d-flex align-items-center justify-content-center shadow-lg" style={{ width: 32, height: 32 }}>
                            <i className="fas fa-shield-alt text-light"></i>
                        </div>
                        <span className="fs-5 fw-bold tracking-wide">AutoSecure</span>
                    </button>
                    <button
                        className="btn btn-link text-secondary p-0 border-0 hover-scale hover-bg-white-10 rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: 40, height: 40, transition: 'all 0.3s' }}
                        onClick={onClose}
                    >
                        <i className="fas fa-arrow-left fa-lg"></i>
                    </button>
                </div>

                <div className="p-3">
                    <div className="text-xs text-secondary fw-bold text-uppercase px-3 mb-2 opacity-50 mt-2">Main Menu</div>

                    <ul className="nav nav-pills flex-column mb-auto gap-1">
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'dashboard' ? 'active' : ''}`}
                                onClick={() => { onNavigate('dashboard'); onClose(); }}
                            >
                                <i className="fas fa-th-large me-3 text-center" style={{ width: 20 }}></i>
                                Dashboard
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'logs' ? 'active' : ''}`}
                                onClick={() => { onNavigate('logs'); onClose(); }}
                            >
                                <i className="fas fa-file-medical-alt me-3 text-center" style={{ width: 20 }}></i>
                                Suspect Log
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'contacts' ? 'active' : ''}`}
                                onClick={() => { onNavigate('contacts'); onClose(); }}
                            >
                                <i className="fas fa-address-book me-3 text-center" style={{ width: 20 }}></i>
                                Emergency Contacts
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'admin' ? 'active shadow-soft' : ''}`}
                                onClick={() => { onNavigate('admin'); onClose(); }}
                            >
                                <i className="fas fa-user-lock me-3 text-center" style={{ width: 20 }}></i>
                                Admin Panel
                            </button>
                        </li>

                        <div className="my-3 border-top border-secondary opacity-25"></div>
                        <div className="text-xs text-secondary fw-bold text-uppercase px-3 mb-2 opacity-50">System</div>

                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'settings' ? 'active' : ''}`}
                                onClick={() => { onNavigate('settings'); onClose(); }}
                            >
                                <i className="fas fa-cog me-3 text-center" style={{ width: 20 }}></i>
                                Settings
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'help' ? 'active' : ''}`}
                                onClick={() => { onNavigate('help'); onClose(); }}
                            >
                                <i className="fas fa-question-circle me-3 text-center" style={{ width: 20 }}></i>
                                Help & Support
                            </button>
                        </li>
                        <li className="nav-item">
                            <button
                                className={`nav-link w-100 ${activePage === 'about' ? 'active' : ''}`}
                                onClick={() => { onNavigate('about'); onClose(); }}
                            >
                                <i className="fas fa-info-circle me-3 text-center" style={{ width: 20 }}></i>
                                About
                            </button>
                        </li>
                    </ul>
                </div>

                <div className="mt-auto p-4 border-top border-dark-subtle bg-black bg-opacity-20">
                    <div className="d-flex align-items-center mb-2">
                        <div className="status-dot bg-success animate-pulse me-2"></div>
                        <span className="text-light text-xs fw-bold">System Online</span>
                    </div>
                    <div className="text-secondary text-xs" style={{ fontSize: '0.75rem' }}>
                        Version 2.1.0 (Stable)
                        <br />Server: Connected
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
