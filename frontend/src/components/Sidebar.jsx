import React from 'react';

// Role permission map
const ROLE_NAV = {
    admin: ['dashboard', 'logs', 'contacts', 'admin', 'users', 'settings', 'help', 'about'],
    manager: ['dashboard', 'logs', 'contacts', 'admin', 'settings', 'help', 'about'],
    security_guard: ['dashboard', 'logs'],
    owner: ['logs'],
};

const navItems = [
    { key: 'dashboard', icon: 'fa-th-large', label: 'Dashboard', section: 'main' },
    { key: 'logs', icon: 'fa-file-medical-alt', label: 'Suspect Log', section: 'main' },
    { key: 'contacts', icon: 'fa-address-book', label: 'Emergency Contacts', section: 'main' },
    { key: 'admin', icon: 'fa-user-plus', label: 'Manage Persons', section: 'main' },
    { key: 'users', icon: 'fa-users-cog', label: 'User Management', section: 'main' },
    { key: 'settings', icon: 'fa-cog', label: 'Settings', section: 'system' },
    { key: 'help', icon: 'fa-question-circle', label: 'Help & Support', section: 'system' },
    { key: 'about', icon: 'fa-info-circle', label: 'About', section: 'system' },
];

const ROLE_LABELS = {
    admin: { label: 'Admin', color: '#7c3aed' },
    manager: { label: 'Manager', color: '#0ea5e9' },
    owner: { label: 'Owner', color: '#f59e0b' },
    security_guard: { label: 'Security Guard', color: '#10b981' },
};

const Sidebar = ({ activePage, onNavigate, isOpen, onClose, user }) => {
    const role = user?.role || 'admin';
    const allowed = ROLE_NAV[role] || ROLE_NAV.admin;
    const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.admin;

    const mainItems = navItems.filter(i => i.section === 'main' && allowed.includes(i.key));
    const systemItems = navItems.filter(i => i.section === 'system' && allowed.includes(i.key));

    return (
        <>
            {/* Mobile overlay */}
            <div className={`sidebar-overlay d-md-none ${isOpen ? 'show' : ''}`} onClick={onClose}></div>

            <div className={`sidebar bg-header d-flex flex-column h-100 position-relative ${isOpen ? 'open' : ''}`} style={{ width: 280, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', zIndex: 1100 }}>
                {/* Logo area */}
                <div className="px-4 py-4 d-flex align-items-center gap-3 border-bottom border-dark-subtle">
                    <div className="p-2 bg-primary text-white rounded-3 shadow-soft d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
                        <i className="fas fa-eye fa-lg"></i>
                    </div>
                    <div>
                        <span className="fs-5 fw-bold text-white tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>AutoSecure</span>
                        <div className="text-secondary" style={{ fontSize: '0.6rem' }}>VISION CORE AI</div>
                    </div>
                    <button className="btn btn-link text-secondary d-md-none ms-auto p-0" onClick={onClose}>
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>

                {/* User badge */}
                <div className="px-4 py-3 border-bottom border-dark-subtle">
                    <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white" 
                             style={{ width: 36, height: 36, background: roleInfo.color, fontSize: '0.85rem' }}>
                            {(user?.name || 'U')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <div className="text-light fw-semibold text-truncate" style={{ fontSize: '0.85rem', maxWidth: 130 }}>{user?.name || 'User'}</div>
                            <span className="badge rounded-pill px-2 py-1" style={{ background: roleInfo.color + '30', color: roleInfo.color, fontSize: '0.65rem', border: `1px solid ${roleInfo.color}50` }}>
                                {roleInfo.label}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-3">
                    {mainItems.length > 0 && (
                        <>
                            <div className="text-xs text-secondary fw-bold text-uppercase px-3 mb-2 opacity-50 mt-2">Main Menu</div>
                            <ul className="nav nav-pills flex-column mb-auto gap-1">
                                {mainItems.map(item => (
                                    <li className="nav-item" key={item.key}>
                                        <button 
                                            className={`nav-link w-100 ${activePage === item.key ? 'active shadow-soft' : ''}`}
                                            onClick={() => { onNavigate(item.key); onClose(); }}
                                        >
                                            <i className={`fas ${item.icon} me-3 text-center`} style={{ width: 20 }}></i>
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}

                    {systemItems.length > 0 && (
                        <>
                            <div className="my-3 border-top border-secondary opacity-25"></div>
                            <div className="text-xs text-secondary fw-bold text-uppercase px-3 mb-2 opacity-50">System</div>
                            <ul className="nav nav-pills flex-column mb-auto gap-1">
                                {systemItems.map(item => (
                                    <li className="nav-item" key={item.key}>
                                        <button 
                                            className={`nav-link w-100 ${activePage === item.key ? 'active' : ''}`}
                                            onClick={() => { onNavigate(item.key); onClose(); }}
                                        >
                                            <i className={`fas ${item.icon} me-3 text-center`} style={{ width: 20 }}></i>
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                <div className="mt-auto p-4 border-top border-dark-subtle bg-black bg-opacity-20">
                    <div className="d-flex align-items-center mb-2">
                        <div className="status-dot bg-success animate-pulse me-2"></div>
                        <span className="text-light text-xs fw-bold">System Online</span>
                    </div>
                    <div className="text-secondary text-xs" style={{ fontSize: '0.75rem' }}>
                        Version 2.2.0 (Stable)
                        <br />Server: Connected
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
