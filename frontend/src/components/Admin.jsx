import React, { useState, useEffect, useRef } from 'react';
import { addPerson, registerSample, fetchPersons, updatePerson, deletePerson } from '../api';
import Sidebar from './Sidebar';

const Admin = () => {
    const [persons, setPersons] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [showLiveModal, setShowLiveModal] = useState(false);

    // Live Register State
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [samples, setSamples] = useState([]);
    const [regForm, setRegForm] = useState({ name: '', relation: 'Visitor', phone: '', address: '' });

    useEffect(() => {
        loadPersons();
    }, []);

    const loadPersons = async () => {
        try {
            const data = await fetchPersons();
            setPersons(data);
        } catch (e) { console.error("Error loading persons", e); }
    };

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
        } catch (e) {
            alert("Camera access denied!");
        }
    };

    const stopCamera = () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        setStream(null);
    };

    const captureSample = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        setSamples([...samples, data]);
    };

    const submitLive = async () => {
        if (samples.length < 1) return alert("Capture at least 1 sample");
        if (!regForm.name) return alert("Name required");

        try {
            const res = await registerSample({ ...regForm, images: samples });
            if (res.success) {
                alert("Registered Successfully!");
                window.location.reload();
            } else {
                alert("Error: " + res.message);
            }
        } catch (e) {
            alert("Error communicating with server");
        }
    };

    const submitManual = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const res = await addPerson(formData);
            if (res.success) {
                setShowAddModal(false);
                loadPersons();
            } else {
                alert("Error: " + res.message);
            }
        } catch (e) {
            alert("Error submitting form");
        }
    };

    const handleEdit = (person) => {
        setEditingPerson(person);
        setShowEditModal(true);
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        try {
            const res = await updatePerson(editingPerson.serial_no, formData);
            if (res.success || !res.error) {
                setShowEditModal(false);
                loadPersons();
            } else {
                alert("Error: " + (res.message || res.error));
            }
        } catch (e) {
            alert("Error updating person");
        }
    };

    const simulateThreat = async () => {
        const type = prompt("Enter threat type (e.g. Knife, Handgun):", "Knife");
        if (type) {
            await fetch('/api/simulate_threat/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            alert(`Simulated ${type} alert triggered!`);
        }
    };

    const handleDelete = async (person) => {
        if (!confirm(`Delete ${person.name}?`)) return;
        try {
            const res = await deletePerson(person.serial_no);
            if (res.success || !res.error) {
                loadPersons();
            } else {
                alert("Error: " + (res.message || res.error));
            }
        } catch (e) {
            alert("Error deleting person");
        }
    };

    return (
        <>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center p-4 border-bottom border-secondary bg-header">
                <div>
                    <h2 className="fw-bold text-heading mb-1">Database Management</h2>
                    <p className="text-secondary mb-0">Manage known faces and system configuration.</p>
                </div>
                <div className="d-flex gap-3">
                    <button className="btn btn-warning fw-bold px-3 shadow-sm hover-scale" onClick={simulateThreat}>
                        <i className="fas fa-exclamation-triangle me-2"></i> Test Alert
                    </button>
                    <button className="btn btn-success fw-bold px-3 shadow-sm hover-scale text-white" onClick={() => setShowLiveModal(true)}>
                        <i className="fas fa-camera me-2"></i> Live Register
                    </button>
                    <button className="btn btn-primary fw-bold px-3 shadow-primary hover-scale" onClick={() => setShowAddModal(true)}>
                        <i className="fas fa-upload me-2"></i> Upload Photo
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 overflow-auto custom-scrollbar flex-grow-1">

                {/* Stats Row */}
                <div className="row g-4 mb-5">
                    <div className="col-lg-3">
                        <div className="stat-card border-secondary bg-panel p-4 d-flex justify-content-between align-items-center rounded-3 shadow-sm hover-elevate">
                            <div>
                                <h2 className="fw-bold mb-0">{persons.length}</h2>
                                <p className="text-secondary small text-uppercase mb-0 tracking-wider">Total Persons</p>
                            </div>
                            <div className="p-3 rounded-circle bg-primary bg-opacity-10 text-primary">
                                <i className="fas fa-users fa-2x"></i>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-3">
                        <div className="stat-card border-secondary bg-panel p-4 d-flex justify-content-between align-items-center rounded-3 shadow-sm hover-elevate">
                            <div>
                                <h2 className="fw-bold mb-0">{persons.filter(p => p.relation === 'Employee').length}</h2>
                                <p className="text-secondary small text-uppercase mb-0 tracking-wider">Employees</p>
                            </div>
                            <div className="p-3 rounded-circle bg-success bg-opacity-10 text-success">
                                <i className="fas fa-id-badge fa-2x"></i>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-3">
                        <div className="stat-card border-secondary bg-panel p-4 d-flex justify-content-between align-items-center rounded-3 shadow-sm hover-elevate">
                            <div>
                                <h2 className="fw-bold mb-0">{persons.filter(p => p.relation.includes('Family')).length}</h2>
                                <p className="text-secondary small text-uppercase mb-0 tracking-wider">Family Members</p>
                            </div>
                            <div className="p-3 rounded-circle bg-info bg-opacity-10 text-info">
                                <i className="fas fa-home fa-2x"></i>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-3">
                        <div className="stat-card border-secondary bg-panel p-4 d-flex justify-content-between align-items-center rounded-3 shadow-sm hover-elevate">
                            <div>
                                <h2 className="fw-bold mb-0">{persons.filter(p => p.relation === 'Visitor' || p.relation === 'Suspect').length}</h2>
                                <p className="text-secondary small text-uppercase mb-0 tracking-wider">Visitors / Others</p>
                            </div>
                            <div className="p-3 rounded-circle bg-warning bg-opacity-10 text-warning">
                                <i className="fas fa-walking fa-2x"></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Persons Grid */}
                <div className="row g-4 animate-fade-in">
                    {persons.map(p => (
                        <div className="col-xl-3 col-lg-4 col-md-6" key={p._id || p.serial_no}>
                            <div className="card h-100 bg-panel border-secondary shadow-sm overflow-hidden hover-border-primary transition-all group">
                                <div className="position-relative" style={{ height: '240px' }}>
                                    <img
                                        src={p.image ? p.image : (p.photo ? `/static/uploads/${p.photo}` : '/static/default_avatar.png')}
                                        className="w-100 h-100 object-fit-cover transition-transform group-hover-scale-110"
                                        alt={p.name}
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300?text=No+Image'; }}
                                    />
                                    <div className="position-absolute bottom-0 start-0 w-100 p-3 bg-gradient-to-t from-black to-transparent">
                                        <h5 className="fw-bold text-white mb-0 text-shadow">{p.name}</h5>
                                        <small className="text-light opacity-75">{p.relation}</small>
                                    </div>
                                    {/* Blue Check for Verified/Employees */}
                                    <div className="position-absolute bottom-0 end-0 m-3">
                                        <span className="badge rounded-circle bg-primary p-2 shadow-sm">
                                            <i className="fas fa-check"></i>
                                        </span>
                                    </div>
                                </div>
                                <div className="card-body bg-panel border-top border-secondary p-3">
                                    <div className="mb-2 d-flex align-items-center text-secondary small">
                                        <i className="fas fa-phone-alt me-3 opacity-50" style={{ width: 16 }}></i>
                                        <span>{p.phone || '+00 000 0000000'}</span>
                                    </div>
                                    <div className="mb-2 d-flex align-items-center text-secondary small">
                                        <i className="fas fa-map-marker-alt me-3 opacity-50" style={{ width: 16 }}></i>
                                        <span className="text-truncate">{p.address || 'No Address'}</span>
                                    </div>
                                    <div className="d-flex align-items-center text-secondary small">
                                        <i className="fas fa-clock me-3 opacity-50" style={{ width: 16 }}></i>
                                        <span>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="p-2 border-top border-secondary bg-dark bg-opacity-25 d-flex gap-2">
                                    <button
                                        className="btn btn-sm btn-outline-light flex-grow-1 border-secondary text-secondary hover-text-white"
                                        onClick={() => handleEdit(p)}
                                    >
                                        <i className="fas fa-edit me-2"></i> Edit
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger border-secondary bg-danger bg-opacity-10 text-danger hover-bg-danger hover-text-white"
                                        onClick={() => handleDelete(p)}
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {persons.length === 0 && (
                        <div className="col-12 text-center py-5 text-secondary opacity-50 border border-dashed border-secondary rounded-3">
                            <i className="fas fa-folder-open fa-3x mb-3"></i>
                            <h5>No Records Found</h5>
                            <p>Start by registering a new person</p>
                        </div>
                    )}
                </div>

            </div>

            {/* Live Modal */}
            {showLiveModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)' }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content bg-panel border-secondary text-light shadow-2xl">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-camera me-2 text-success"></i> Live Face Registration</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowLiveModal(false); stopCamera(); }}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="row g-0">
                                    {/* Camera Feed */}
                                    <div className="col-lg-8 bg-black position-relative" style={{ minHeight: '500px' }}>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-100 h-100 object-fit-cover"
                                            onLoadedMetadata={() => videoRef.current.play()}
                                        ></video>

                                        {!stream && (
                                            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark z-20">
                                                <button className="btn btn-primary btn-lg rounded-pill px-5 shadow-primary" onClick={startCamera}>
                                                    <i className="fas fa-video me-2"></i> Start Camera
                                                </button>
                                            </div>
                                        )}

                                        <div className="position-absolute bottom-0 start-0 w-100 p-4 bg-gradient-to-t from-black to-transparent d-flex justify-content-center gap-3">
                                            <button className="btn btn-light rounded-circle shadow-lg hover-scale" style={{ width: 64, height: 64 }} onClick={captureSample} disabled={!stream}>
                                                <i className="fas fa-camera fa-lg"></i>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sidebar Controls */}
                                    <div className="col-lg-4 border-start border-secondary bg-panel d-flex flex-column">
                                        <div className="p-4 border-bottom border-secondary">
                                            <h6 className="text-secondary text-uppercase fw-bold small mb-3">Person Details</h6>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Full Name</label>
                                                <input
                                                    className="form-control bg-dark border-secondary text-white"
                                                    value={regForm.name}
                                                    onChange={e => setRegForm({ ...regForm, name: e.target.value })}
                                                    placeholder="Enter name..."
                                                />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Relationship / Role</label>
                                                <select
                                                    className="form-select bg-dark border-secondary text-white"
                                                    value={regForm.relation}
                                                    onChange={e => setRegForm({ ...regForm, relation: e.target.value })}
                                                >
                                                    <option value="Visitor">Visitor</option>
                                                    <option value="Family">Family Member</option>
                                                    <option value="Employee">Employee</option>
                                                    <option value="Suspect">Known Suspect</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="p-4 flex-grow-1 overflow-auto custom-scrollbar">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="text-secondary text-uppercase fw-bold small mb-0">Captured Samples</h6>
                                                <span className="badge bg-secondary">{samples.length}</span>
                                            </div>

                                            <div className="d-grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid' }}>
                                                {samples.map((s, i) => (
                                                    <div key={i} className="position-relative ratio ratio-1x1 border border-secondary rounded overflow-hidden group">
                                                        <img src={s} className="w-100 h-100 object-fit-cover" />
                                                        <button
                                                            className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 p-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm"
                                                            style={{ width: 20, height: 20 }}
                                                            onClick={() => setSamples(samples.filter((_, idx) => idx !== i))}
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ))}
                                                {samples.length === 0 && (
                                                    <div className="grid-column-full text-center py-4 text-secondary small fst-italic border border-dashed border-secondary rounded bg-dark bg-opacity-25" style={{ gridColumn: '1 / -1' }}>
                                                        No samples captured
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-4 border-top border-secondary">
                                            <button className="btn btn-success w-100 py-3 fw-bold text-uppercase shadow-success hover-scale" onClick={submitLive} disabled={samples.length === 0 || !regForm.name}>
                                                <i className="fas fa-check-circle me-2"></i> Register Person
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={submitManual} className="modal-content bg-panel text-light border-secondary shadow-lg">
                            <div className="modal-header border-bottom border-secondary"><h5 className="modal-title fw-bold">Register New Person</h5><button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button></div>
                            <div className="modal-body p-4">
                                <div className="mb-3"><label className="text-secondary small">Name</label><input name="name" className="form-control bg-dark border-secondary text-white" required /></div>
                                <div className="mb-3"><label className="text-secondary small">Role</label><select name="relation" className="form-select bg-dark border-secondary text-white"><option>Family</option><option>Employee</option><option>Visitor</option><option>Suspect</option></select></div>
                                <div className="mb-3"><label className="text-secondary small">Phone</label><input name="phone" className="form-control bg-dark border-secondary text-white" required /></div>
                                <div className="mb-3"><label className="text-secondary small">Address</label><textarea name="address" className="form-control bg-dark border-secondary text-white" required></textarea></div>
                                <div className="mb-3"><label className="text-secondary small">Photo</label><input type="file" name="photo" className="form-control bg-dark border-secondary text-white" accept="image/*" required /></div>
                            </div>
                            <div className="modal-footer border-top border-secondary"><button type="submit" className="btn btn-primary w-100 shadow-primary">Save Person</button></div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Modal */}
            {showEditModal && editingPerson && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={submitEdit} className="modal-content bg-panel text-light border-secondary shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold">Edit Person: {editingPerson.name}</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3">
                                    <label className="text-secondary small">Name</label>
                                    <input name="name" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.name} required />
                                </div>
                                <div className="mb-3">
                                    <label className="text-secondary small">Role</label>
                                    <select name="relation" className="form-select bg-dark border-secondary text-white" defaultValue={editingPerson.relation}>
                                        <option>Family</option>
                                        <option>Employee</option>
                                        <option>Visitor</option>
                                        <option>Suspect</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="text-secondary small">Phone</label>
                                    <input name="phone" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.phone} required />
                                </div>
                                <div className="mb-3">
                                    <label className="text-secondary small">Address</label>
                                    <textarea name="address" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.address} required></textarea>
                                </div>
                                <div className="mb-3">
                                    <label className="text-secondary small">Photo (Optional)</label>
                                    <input type="file" name="photo" className="form-control bg-dark border-secondary text-white" accept="image/*" />
                                    <small className="text-muted">Leave blank to keep existing photo</small>
                                </div>
                            </div>
                            <div className="modal-footer border-top border-secondary">
                                <button type="submit" className="btn btn-primary w-100 shadow-primary">Update Person</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Admin;
