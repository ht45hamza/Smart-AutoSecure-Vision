import React, { useState, useEffect } from 'react';
import { addContact, fetchContacts } from '../api';
import Sidebar from './Sidebar';

const Contacts = () => {
    const [contacts, setContacts] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        loadContacts();
    }, []);

    const [formData, setFormData] = useState({ name: '', phone: '', relation: 'Security' });

    const loadContacts = async () => {
        try {
            const data = await fetchContacts();
            setContacts(data || []);
        } catch (e) { console.error(e); }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        try {
            await addContact(formData.name, formData.phone, formData.relation);
            setShowAddModal(false);
            setFormData({ name: '', phone: '', relation: 'Security' });
            loadContacts();
        } catch (e) { alert("Failed to add contact"); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        try {
            // Import deleteContact at top if not present, but I see I imported addContact only
            // I need to import deleteContact from api
            const { deleteContact } = await import('../api');
            await deleteContact(id);
            loadContacts();
        } catch (e) { console.error(e); }
    };

    return (
        <>
            <div className="p-4 overflow-auto custom-scrollbar flex-grow-1 h-100">
                <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-secondary pb-4">
                    <div>
                        <h2 className="fw-bold text-heading text-uppercase mb-1"><i className="fas fa-phone-volume me-2"></i> Emergency Contacts</h2>
                        <p className="text-secondary mb-0">Manage personnel to be auto-dialed during security alerts.</p>
                    </div>
                    <button className="btn btn-danger shadow-lg hover-scale" onClick={() => setShowAddModal(true)}>
                        <i className="fas fa-user-plus me-2"></i> Add Contact
                    </button>
                </div>

                <div className="row g-4 animate-fade-in">
                    {contacts.length > 0 ? (
                        contacts.map((c) => (
                            <div className="col-md-6 col-lg-4" key={c._id}>
                                <div className="card bg-panel border-secondary h-100 shadow-sm hover-elevate transition-all group">
                                    <div className="card-body d-flex align-items-center gap-3">
                                        <div className="bg-danger bg-opacity-10 text-danger rounded-circle p-3 d-flex align-items-center justify-content-center shadow-inner" style={{ width: 64, height: 64 }}>
                                            <i className="fas fa-user-shield fa-2x"></i>
                                        </div>
                                        <div className="flex-grow-1 overflow-hidden">
                                            <h5 className="mb-1 text-light fw-bold text-truncate">{c.name}</h5>
                                            <div className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 mb-2">{c.relation}</div>
                                            <div className="text-secondary small font-monospace"><i className="fas fa-phone-alt me-2"></i>{c.phone}</div>
                                        </div>
                                        <button
                                            className="btn btn-outline-danger btn-sm rounded-circle opacity-50 group-hover-opacity-100 transition-all border-0 bg-transparent hover-bg-danger hover-text-white"
                                            onClick={() => handleDelete(c._id)}
                                            title="Delete Contact"
                                            style={{ width: 32, height: 32, padding: 0 }}
                                        >
                                            <i className="fas fa-trash-alt"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        null
                    )}

                    {contacts.length === 0 && (
                        <div className="col-12 text-center py-5">
                            <div className="text-secondary opacity-25 mb-3"><i className="fas fa-address-book fa-5x"></i></div>
                            <h4 className="text-secondary">No contacts configured.</h4>
                            <p className="text-muted">Add security personnel to ensure rapid response.</p>
                        </div>
                    )}
                </div>
            </div>

            {showAddModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={handleAdd} className="modal-content bg-dark border-secondary text-light shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-user-plus me-2 text-danger"></i> Add Emergency Contact</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label text-secondary small text-uppercase fw-bold">Full Name</label>
                                    <input
                                        className="form-control bg-black border-secondary text-white"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="e.g. Officer John Doe"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label text-secondary small text-uppercase fw-bold">Phone Number</label>
                                    <input
                                        className="form-control bg-black border-secondary text-white"
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        required
                                        placeholder="e.g. +1 555-0123"
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label text-secondary small text-uppercase fw-bold">Role / Relation</label>
                                    <select
                                        className="form-select bg-black border-secondary text-white"
                                        value={formData.relation}
                                        onChange={e => setFormData({ ...formData, relation: e.target.value })}
                                    >
                                        <option value="Security">Security Personnel</option>
                                        <option value="Police">Police / Law Enforcement</option>
                                        <option value="Owner">Owner / Manager</option>
                                        <option value="Medical">Medical / Ambulance</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer border-top border-secondary">
                                <button type="button" className="btn btn-outline-light" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-danger px-4">Save Contact</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Contacts;
