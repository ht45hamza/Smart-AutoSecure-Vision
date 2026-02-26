import React from 'react';

const Sidebar = ({ activePage }) => {
    return (
        <div className="d-flex flex-column flex-shrink-0 p-3 bg-header border-end border-secondary" style={{ width: '280px', minHeight: '100vh' }}>
            <button
                onClick={() => window.showComponent('dashboard')}
                className="d-flex align-items-center mb-4 mb-md-0 ms-2 text-white text-decoration-none bg-transparent border-0"
            >
                <i className="fas fa-eye fa-2x text-primary me-3"></i>
                <span className="fs-4 fw-bold tracking-wider">AutoSecure</span>
            </button>
            <hr className="border-secondary my-4" />
            <ul className="nav nav-pills flex-column mb-auto gap-2">
                <li className="nav-item">
                    <button
                        className={`nav-link text-start w-100 ${activePage === 'dashboard' ? 'active bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' : 'text-secondary hover-text-white bg-transparent border-0'}`}
                        onClick={() => window.showComponent('dashboard')}
                    >
                        <i className="fas fa-chart-line me-3" style={{ width: 20 }}></i>
                        Live Dashboard
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link text-start w-100 ${activePage === 'admin' ? 'active bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' : 'text-secondary hover-text-white bg-transparent border-0'}`}
                        onClick={() => window.showComponent('admin')}
                    >
                        <i className="fas fa-users-cog me-3" style={{ width: 20 }}></i>
                        Settings
                    </button>
                </li>
                <li>
                    <button
                        className={`nav-link text-start w-100 ${activePage === 'contacts' ? 'active bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' : 'text-secondary hover-text-white bg-transparent border-0'}`}
                        onClick={() => window.showComponent('contacts')}
                    >
                        <i className="fas fa-phone-alt me-3" style={{ width: 20 }}></i>
                        Emergency Contacts
                    </button>
                </li>
                <li>
                    <button
                        className={`nav-link text-start w-100 ${activePage === 'logs' ? 'active bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25' : 'text-secondary hover-text-white bg-transparent border-0'}`}
                        onClick={() => window.showComponent('logs')}
                    >
                        <i className="fas fa-file-alt me-3" style={{ width: 20 }}></i>
                        Suspect Log
                    </button>
                </li>
            </ul>
            <div className="mt-auto p-3 bg-dark bg-opacity-50 rounded border border-secondary border-opacity-25 text-center text-secondary small">
                <i className="fas fa-server mb-2"></i><br />
                System Online v1.0.4
            </div>
        </div>
    );
};

export default Sidebar;
