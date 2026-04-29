import React, { useState, useEffect } from 'react';
import { fetchSubUsers, createSubUser, deleteSubUser, updateSubUser } from '../api';

const ROLE_META = {
    owner: { color: '#f59e0b', icon: 'fa-crown', desc: 'Can view suspect logs and details only.' },
    manager: { color: '#0ea5e9', icon: 'fa-user-tie', desc: 'Full access except user management.' },
    security_guard: { color: '#10b981', icon: 'fa-user-shield', desc: 'Dashboard + suspect logs (read-only).' },
};

const emptyForm = { name: '', email: '', password: '', role: 'manager', whatsapp_number: '' };

const UserManagement = ({ user }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [editForm, setEditForm] = useState({ name: '', whatsapp_number: '', password: '' });
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await fetchSubUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMsg({ type: '', text: '' });
        try {
            const res = await createSubUser(form);
            if (res.success) {
                setMsg({ type: 'success', text: res.message });
                setForm(emptyForm);
                setShowCreate(false);
                loadUsers();
            } else {
                setMsg({ type: 'danger', text: res.message || 'Failed to create user.' });
            }
        } catch (err) {
            setMsg({ type: 'danger', text: 'Connection error: ' + err.message });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (u) => {
        if (!confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
        try {
            const res = await deleteSubUser(u._id);
            if (res.success) {
                setUsers(prev => prev.filter(x => x._id !== u._id));
            } else {
                alert('Error: ' + (res.message || 'Failed to delete'));
            }
        } catch (e) {
            alert('Error deleting user');
        }
    };

    const openEdit = (u) => {
        setEditTarget(u);
        setEditForm({ name: u.name, whatsapp_number: u.whatsapp_number || '', password: '' });
        setShowEdit(true);
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await updateSubUser(editTarget._id, editForm);
            if (res.success) {
                setShowEdit(false);
                loadUsers();
            } else {
                alert('Error: ' + (res.message || 'Update failed'));
            }
        } catch (e) {
            alert('Connection error');
        } finally {
            setSubmitting(false);
        }
    };

    const roleCount = (role) => users.filter(u => u.role === role).length;

    return (
        <>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-4 border-bottom border-secondary bg-header">
                <div>
                    <h2 className="fw-bold text-heading mb-1">
                        <i className="fas fa-users-cog me-3 text-primary"></i>User Management
                    </h2>
                    <p className="text-secondary mb-0">Create and manage role-restricted accounts for your team.</p>
                </div>
                <button className="btn btn-primary fw-bold px-4 shadow-primary hover-scale" onClick={() => { setMsg({ type: '', text: '' }); setForm(emptyForm); setShowCreate(true); }}>
                    <i className="fas fa-user-plus me-2"></i>Create User
                </button>
            </div>

            <div className="p-4 overflow-auto custom-scrollbar flex-grow-1">

                {/* Flash message */}
                {msg.text && (
                    <div className={`alert alert-${msg.type} alert-dismissible mb-4`}>
                        {msg.text}
                        <button className="btn-close" onClick={() => setMsg({ type: '', text: '' })}></button>
                    </div>
                )}

                {/* Role info cards */}
                <div className="row g-4 mb-5">
                    {Object.entries(ROLE_META).map(([role, meta]) => (
                        <div className="col-md-4" key={role}>
                            <div className="stat-card border-secondary bg-panel p-4 rounded-3 shadow-sm hover-elevate h-100" style={{ borderLeft: `4px solid ${meta.color}` }}>
                                <div className="d-flex align-items-center gap-3 mb-3">
                                    <div className="p-3 rounded-circle" style={{ background: meta.color + '20', color: meta.color }}>
                                        <i className={`fas ${meta.icon} fa-lg`}></i>
                                    </div>
                                    <div>
                                        <h2 className="fw-bold mb-0" style={{ color: meta.color }}>{roleCount(role)}</h2>
                                        <p className="text-secondary small text-uppercase mb-0 tracking-wider" style={{ fontSize: '0.7rem' }}>
                                            {role.replace('_', ' ')}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-secondary small mb-0">{meta.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Users Table */}
                <div className="bg-panel border border-secondary rounded-3 overflow-hidden shadow-sm">
                    <div className="p-3 border-bottom border-secondary bg-dark-header d-flex justify-content-between align-items-center">
                        <h6 className="fw-bold mb-0 text-heading"><i className="fas fa-list me-2 text-secondary"></i>All Sub-Users</h6>
                        <span className="badge bg-secondary">{users.length}</span>
                    </div>

                    {loading ? (
                        <div className="text-center py-5 text-secondary">
                            <div className="spinner-border text-primary mb-3"></div>
                            <p>Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-5 text-secondary opacity-50">
                            <i className="fas fa-user-slash fa-3x mb-3"></i>
                            <h5>No sub-users yet</h5>
                            <p>Create your first user to get started.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-dark table-hover mb-0 align-middle">
                                <thead className="text-secondary text-uppercase" style={{ fontSize: '0.72rem' }}>
                                    <tr>
                                        <th className="ps-4">User</th>
                                        <th>Role</th>
                                        <th>WhatsApp</th>
                                        <th>Created</th>
                                        <th className="text-end pe-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => {
                                        const meta = ROLE_META[u.role] || { color: '#6b7280', icon: 'fa-user', desc: '' };
                                        return (
                                            <tr key={u._id}>
                                                <td className="ps-4">
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                                                            style={{ width: 38, height: 38, background: meta.color, fontSize: '0.9rem', minWidth: 38 }}>
                                                            {(u.name || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="fw-semibold text-light">{u.name}</div>
                                                            <div className="text-secondary small">{u.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge rounded-pill px-3 py-2"
                                                        style={{ background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}50`, fontSize: '0.72rem' }}>
                                                        <i className={`fas ${meta.icon} me-2`}></i>
                                                        {u.role.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td>
                                                    {u.whatsapp_number
                                                        ? <span className="text-success small"><i className="fab fa-whatsapp me-2"></i>{u.whatsapp_number}</span>
                                                        : <span className="text-secondary small fst-italic">Not set</span>}
                                                </td>
                                                <td className="text-secondary small">
                                                    {u.created_at ? new Date(u.created_at * 1000).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="pe-4 text-end">
                                                    <div className="d-flex gap-2 justify-content-end">
                                                        <button className="btn btn-sm btn-outline-light border-secondary" onClick={() => openEdit(u)} title="Edit user">
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(u)} title="Delete user">
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create User Modal */}
            {showCreate && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 2100 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <form onSubmit={handleCreate} className="modal-content bg-panel text-light border-primary shadow-lg">
                            <div className="modal-header border-bottom border-primary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-user-plus me-2 text-primary"></i>Create New User</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreate(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {/* Role Picker */}
                                <div className="mb-4">
                                    <label className="form-label text-secondary small fw-bold">Select Role</label>
                                    <div className="row g-3">
                                        {Object.entries(ROLE_META).map(([role, meta]) => (
                                            <div className="col-md-4" key={role}>
                                                <div
                                                    className={`p-3 rounded-3 border cursor-pointer transition-all ${form.role === role ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary bg-dark'}`}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setForm({ ...form, role })}
                                                >
                                                    <div className="d-flex align-items-center gap-2 mb-2">
                                                        <i className={`fas ${meta.icon}`} style={{ color: meta.color }}></i>
                                                        <span className="fw-bold small text-capitalize">{role.replace('_', ' ')}</span>
                                                        {form.role === role && <i className="fas fa-check-circle ms-auto text-primary"></i>}
                                                    </div>
                                                    <p className="text-secondary mb-0" style={{ fontSize: '0.72rem' }}>{meta.desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="row g-3">
                                    <div className="col-md-6">
                                        <label className="form-label text-secondary small">Full Name <span className="text-danger">*</span></label>
                                        <input className="form-control bg-dark border-secondary text-white" placeholder="Enter full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-secondary small">Email Address <span className="text-danger">*</span></label>
                                        <input type="email" className="form-control bg-dark border-secondary text-white" placeholder="user@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-secondary small">Password <span className="text-danger">*</span></label>
                                        <input type="password" className="form-control bg-dark border-secondary text-white" placeholder="Set a strong password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-secondary small">
                                            <i className="fab fa-whatsapp me-2 text-success"></i>WhatsApp Number
                                            {(form.role === 'manager' || form.role === 'owner') && <span className="text-warning ms-2 small">(for alerts)</span>}
                                        </label>
                                        <input className="form-control bg-dark border-secondary text-white" placeholder="+923001234567" value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} />
                                        <small className="text-muted">Include country code. Used for WhatsApp alerts on suspect detection.</small>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-top border-primary">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary fw-bold px-4" disabled={submitting}>
                                    {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</> : <><i className="fas fa-user-plus me-2"></i>Create User</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEdit && editTarget && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', zIndex: 2100 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={handleEdit} className="modal-content bg-panel text-light border-secondary shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-user-edit me-2 text-info"></i>Edit: {editTarget.name}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEdit(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3">
                                    <label className="form-label text-secondary small">Full Name</label>
                                    <input className="form-control bg-dark border-secondary text-white" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label text-secondary small"><i className="fab fa-whatsapp me-2 text-success"></i>WhatsApp Number</label>
                                    <input className="form-control bg-dark border-secondary text-white" placeholder="+923001234567" value={editForm.whatsapp_number} onChange={e => setEditForm({ ...editForm, whatsapp_number: e.target.value })} />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label text-secondary small">New Password <span className="text-muted">(leave blank to keep)</span></label>
                                    <input type="password" className="form-control bg-dark border-secondary text-white" placeholder="Enter new password..." value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} minLength={6} />
                                </div>
                                <div className="alert alert-dark border-secondary small mt-3 mb-0">
                                    <i className="fas fa-info-circle me-2 text-info"></i>Role: <strong className="text-capitalize">{editTarget.role.replace('_', ' ')}</strong> — role cannot be changed after creation.
                                </div>
                            </div>
                            <div className="modal-footer border-top border-secondary">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                                <button type="submit" className="btn btn-info fw-bold px-4" disabled={submitting}>
                                    {submitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="fas fa-save me-2"></i>Save Changes</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default UserManagement;
