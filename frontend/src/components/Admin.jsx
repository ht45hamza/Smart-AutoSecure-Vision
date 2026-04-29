import React, { useState, useEffect, useRef } from 'react';
import { addPerson, registerSample, fetchPersons, updatePerson, deletePerson, addSuspect } from '../api';

const Admin = ({ user }) => {
    const role = user?.role || 'admin';
    const canMutate = role === 'admin' || role === 'manager';
    const [activeTab, setActiveTab] = useState('known'); // 'known' | 'suspects'
    const [persons, setPersons] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [showLiveModal, setShowLiveModal] = useState(false);
    const [showSuspectModal, setShowSuspectModal] = useState(false);
    const [suspectLoading, setSuspectLoading] = useState(false);
    const [suspectMsg, setSuspectMsg] = useState({ type: '', text: '' });
    const [suspectForm, setSuspectForm] = useState({ name: '', phone: '', address: '', notes: '' });
    const [suspectPhoto, setSuspectPhoto] = useState(null);
    const [suspectPreview, setSuspectPreview] = useState(null);

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

    const openSuspectModal = () => {
        setSuspectMsg({ type: '', text: '' });
        setSuspectForm({ name: '', phone: '', address: '', notes: '' });
        setSuspectPhoto(null);
        setSuspectPreview(null);
        setShowSuspectModal(true);
    };

    const handleSuspectPhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setSuspectPhoto(file);
        setSuspectPreview(URL.createObjectURL(file));
    };

    const submitSuspect = async (e) => {
        e.preventDefault();
        if (!suspectPhoto) { setSuspectMsg({ type: 'danger', text: 'A face photo is required for detection.' }); return; }
        setSuspectLoading(true);
        setSuspectMsg({ type: '', text: '' });
        try {
            const fd = new FormData();
            fd.append('name', suspectForm.name);
            fd.append('phone', suspectForm.phone || 'N/A');
            fd.append('address', suspectForm.address || 'N/A');
            fd.append('notes', suspectForm.notes || '');
            fd.append('photo', suspectPhoto);
            const res = await addSuspect(fd);
            if (res.success) {
                setSuspectMsg({ type: 'success', text: res.message });
                setTimeout(() => { setShowSuspectModal(false); loadPersons(); }, 1800);
            } else {
                setSuspectMsg({ type: 'danger', text: res.message || 'Failed to add suspect.' });
            }
        } catch (err) {
            setSuspectMsg({ type: 'danger', text: 'Connection error: ' + err.message });
        } finally {
            setSuspectLoading(false);
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
        <div className="p-4 overflow-auto custom-scrollbar flex-grow-1 h-100 bg-dark-theme text-light">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-3">
                <div>
                    <h2 className="fw-bold text-heading mb-1">Manage Persons</h2>
                    <p className="text-secondary mb-0">Register known persons and suspects for live camera detection.</p>
                </div>
                {canMutate && (
                    <div className="d-flex gap-3 flex-wrap">
                        <button className="btn btn-warning fw-bold px-3 shadow-sm hover-scale" onClick={simulateThreat}>
                            <i className="fas fa-exclamation-triangle me-2"></i> Test Alert
                        </button>
                        <button className="btn btn-danger fw-bold px-3 hover-scale text-white" onClick={openSuspectModal}
                            title="Register a suspect — triggers emergency alert on camera detection">
                            <i className="fas fa-user-slash me-2"></i> Add Suspect
                        </button>
                        <button className="btn btn-success fw-bold px-3 shadow-sm hover-scale text-white" onClick={() => setShowLiveModal(true)}>
                            <i className="fas fa-camera me-2"></i> Live Register
                        </button>
                        <button className="btn btn-primary fw-bold px-3 shadow-primary hover-scale" onClick={() => setShowAddModal(true)}>
                            <i className="fas fa-upload me-2"></i> Upload Photo
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="d-flex gap-2 mb-4 border-bottom border-secondary pb-3">
                <button
                    className={`btn fw-bold px-4 py-2 rounded-pill ${activeTab === 'known' ? 'btn-success shadow-sm' : 'btn-outline-secondary text-secondary'}`}
                    onClick={() => setActiveTab('known')}
                >
                    <i className="fas fa-user-check me-2"></i>
                    Known Persons
                    <span className={`badge ms-2 rounded-pill ${activeTab === 'known' ? 'bg-white text-success' : 'bg-secondary'}`}>
                        {persons.filter(p => !p.relation?.toLowerCase().includes('suspect')).length}
                    </span>
                </button>
                <button
                    className={`btn fw-bold px-4 py-2 rounded-pill ${activeTab === 'suspects' ? 'btn-danger shadow-sm' : 'btn-outline-danger text-danger'}`}
                    onClick={() => setActiveTab('suspects')}
                >
                    <i className="fas fa-user-slash me-2"></i>
                    Suspects
                    <span className={`badge ms-2 rounded-pill ${activeTab === 'suspects' ? 'bg-white text-danger' : 'bg-danger'}`}>
                        {persons.filter(p => p.relation?.toLowerCase().includes('suspect')).length}
                    </span>
                </button>
            </div>

            {/* Content Area */}
            <div className="row g-4 animate-fade-in">
                {activeTab === 'known' ? (
                    <>
                        {persons.filter(p => !p.relation?.toLowerCase().includes('suspect')).map(p => (
                            <div className="col-xl-3 col-lg-4 col-md-6" key={p._id || p.serial_no}>
                                <div className="card h-100 bg-panel border-secondary shadow-sm overflow-hidden transition-all group" style={{ borderLeft: '3px solid #22c55e' }}>
                                    <div className="position-relative" style={{ height: '200px' }}>
                                        <img src={p.image ? p.image : (p.photo ? `/static/uploads/${p.photo}` : '/static/default_avatar.png')}
                                            className="w-100 h-100 object-fit-cover" alt={p.name}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300?text=No+Image'; }} />
                                        <div className="position-absolute bottom-0 start-0 w-100 p-2" style={{ background: 'linear-gradient(to top, #000c, transparent)' }}>
                                            <h6 className="fw-bold text-white mb-0">{p.name}</h6>
                                            <span className="badge bg-success bg-opacity-75 small">{p.relation}</span>
                                        </div>
                                    </div>
                                    <div className="card-body p-3">
                                        <div className="text-secondary small mb-1"><i className="fas fa-phone-alt me-2 opacity-50"></i>{p.phone || 'N/A'}</div>
                                        <div className="text-secondary small text-truncate"><i className="fas fa-map-marker-alt me-2 opacity-50"></i>{p.address || 'No Address'}</div>
                                        <div className="text-secondary small"><i className="fas fa-clock me-2 opacity-50"></i>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}</div>
                                    </div>
                                    <div className="p-2 border-top border-secondary bg-dark bg-opacity-25 d-flex gap-2">
                                        {canMutate ? (<>
                                            <button className="btn btn-sm btn-outline-light flex-grow-1 border-secondary" onClick={() => handleEdit(p)}>
                                                <i className="fas fa-edit me-1"></i>Edit
                                            </button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p)}>
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </>) : (
                                            <span className="text-secondary small fst-italic px-2"><i className="fas fa-eye me-1"></i>View Only</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {persons.filter(p => !p.relation?.toLowerCase().includes('suspect')).length === 0 && (
                            <div className="col-12 text-center py-5 text-secondary opacity-50">
                                <i className="fas fa-user-plus fa-3x mb-3"></i>
                                <h5>No known persons registered yet</h5>
                                <p>Use "Upload Photo" or "Live Register" to add someone.</p>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {persons.filter(p => p.relation?.toLowerCase().includes('suspect')).map(p => (
                            <div className="col-xl-3 col-lg-4 col-md-6" key={p._id || p.serial_no}>
                                <div className="card h-100 border-danger shadow-sm overflow-hidden transition-all" style={{ background: '#1a0505', borderLeft: '4px solid #ef4444' }}>
                                    <div className="position-relative" style={{ height: '200px' }}>
                                        <img src={p.image ? p.image : (p.photo ? `/static/uploads/${p.photo}` : '/static/default_avatar.png')}
                                            className="w-100 h-100 object-fit-cover" alt={p.name}
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/300?text=No+Image'; }} />
                                        <div className="position-absolute top-0 end-0 m-2">
                                            <span className="badge bg-danger animate-pulse px-2 py-1 rounded-pill">
                                                <i className="fas fa-exclamation-triangle me-1"></i>SUSPECT
                                            </span>
                                        </div>
                                        <div className="position-absolute bottom-0 start-0 w-100 p-2" style={{ background: 'linear-gradient(to top, #7f0000cc, transparent)' }}>
                                            <h6 className="fw-bold text-white mb-0">{p.name}</h6>
                                            <small className="text-danger-emphasis">{p.relation}</small>
                                        </div>
                                    </div>
                                    <div className="p-3" style={{ background: '#1a0505' }}>
                                        <div className="text-secondary small mb-1"><i className="fas fa-phone-alt me-2 opacity-50"></i>{p.phone || 'N/A'}</div>
                                        <div className="text-secondary small text-truncate"><i className="fas fa-map-marker-alt me-2 opacity-50"></i>{p.address || 'N/A'}</div>
                                        {p.notes && <div className="text-danger-emphasis small mt-1"><i className="fas fa-sticky-note me-2"></i>{p.notes}</div>}
                                    </div>
                                    <div className="p-2 border-top border-danger border-opacity-25 d-flex gap-2" style={{ background: '#1a0505' }}>
                                        {canMutate ? (<>
                                            <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => handleEdit(p)}>
                                                <i className="fas fa-edit me-1"></i>Edit
                                            </button>
                                            <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>
                                                <i className="fas fa-trash-alt"></i>
                                            </button>
                                        </>) : (
                                            <span className="text-danger small fst-italic px-2"><i className="fas fa-lock me-1"></i>Read Only</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {persons.filter(p => p.relation?.toLowerCase().includes('suspect')).length === 0 && (
                            <div className="col-12 text-center py-5 opacity-50">
                                <i className="fas fa-user-slash fa-3x mb-3 text-danger"></i>
                                <h5 className="text-secondary">No suspects registered</h5>
                                <p className="text-secondary">Use "Add Suspect" button to register a known threat.</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Live Modal */}
            {showLiveModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)', zIndex: 2000 }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content bg-panel border-secondary text-light shadow-2xl">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold"><i className="fas fa-camera me-2 text-success"></i> Live Face Registration</h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowLiveModal(false); stopCamera(); }}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="row g-0">
                                    <div className="col-lg-8 bg-black position-relative" style={{ minHeight: '500px' }}>
                                        <video ref={videoRef} autoPlay playsInline muted className="w-100 h-100 object-fit-cover" onLoadedMetadata={() => videoRef.current.play()}></video>
                                        {!stream && (
                                            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark z-20">
                                                <button className="btn btn-primary btn-lg rounded-pill px-5 shadow-primary" onClick={startCamera}><i className="fas fa-video me-2"></i> Start Camera</button>
                                            </div>
                                        )}
                                        <div className="position-absolute bottom-0 start-0 w-100 p-4 bg-gradient-to-t from-black to-transparent d-flex justify-content-center gap-3">
                                            <button className="btn btn-light rounded-circle shadow-lg hover-scale" style={{ width: 64, height: 64 }} onClick={captureSample} disabled={!stream}><i className="fas fa-camera fa-lg"></i></button>
                                        </div>
                                    </div>
                                    <div className="col-lg-4 border-start border-secondary bg-panel d-flex flex-column">
                                        <div className="p-4 border-bottom border-secondary">
                                            <h6 className="text-secondary text-uppercase fw-bold small mb-3">Person Details</h6>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Full Name</label>
                                                <input className="form-control bg-dark border-secondary text-white" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} placeholder="Enter name..." />
                                            </div>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary small">Relationship / Role</label>
                                                <select className="form-select bg-dark border-secondary text-white" value={regForm.relation} onChange={e => setRegForm({ ...regForm, relation: e.target.value })}>
                                                    <option value="Visitor">Visitor</option>
                                                    <option value="Family">Family Member</option>
                                                    <option value="Employee">Employee</option>
                                                    <option value="Suspect">Known Suspect</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="p-4 flex-grow-1 overflow-auto custom-scrollbar">
                                            <div className="d-flex justify-content-between align-items-center mb-3"><h6 className="text-secondary text-uppercase fw-bold small mb-0">Captured Samples</h6><span className="badge bg-secondary">{samples.length}</span></div>
                                            <div className="d-grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)', display: 'grid' }}>
                                                {samples.map((s, i) => (
                                                    <div key={i} className="position-relative ratio ratio-1x1 border border-secondary rounded overflow-hidden group">
                                                        <img src={s} className="w-100 h-100 object-fit-cover" />
                                                        <button className="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 p-0 rounded-circle d-flex align-items-center justify-content-center shadow-sm" style={{ width: 20, height: 20 }} onClick={() => setSamples(samples.filter((_, idx) => idx !== i))}>&times;</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-4 border-top border-secondary">
                                            <button className="btn btn-success w-100 py-3 fw-bold text-uppercase shadow-success hover-scale" onClick={submitLive} disabled={samples.length === 0 || !regForm.name}><i className="fas fa-check-circle me-2"></i> Register Person</button>
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
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000 }}>
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
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <form onSubmit={submitEdit} className="modal-content bg-panel text-light border-secondary shadow-lg">
                            <div className="modal-header border-bottom border-secondary"><h5 className="modal-title fw-bold">Edit Person: {editingPerson.name}</h5><button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button></div>
                            <div className="modal-body p-4">
                                <div className="mb-3"><label className="text-secondary small">Name</label><input name="name" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.name} required /></div>
                                <div className="mb-3"><label className="text-secondary small">Role</label><select name="relation" className="form-select bg-dark border-secondary text-white" defaultValue={editingPerson.relation}><option>Family</option><option>Employee</option><option>Visitor</option><option>Suspect</option></select></div>
                                <div className="mb-3"><label className="text-secondary small">Phone</label><input name="phone" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.phone} required /></div>
                                <div className="mb-3"><label className="text-secondary small">Address</label><textarea name="address" className="form-control bg-dark border-secondary text-white" defaultValue={editingPerson.address} required></textarea></div>
                                <div className="mb-3"><label className="text-secondary small">Photo (Optional)</label><input type="file" name="photo" className="form-control bg-dark border-secondary text-white" accept="image/*" /><small className="text-muted">Leave blank to keep existing photo</small></div>
                            </div>
                            <div className="modal-footer border-top border-secondary"><button type="submit" className="btn btn-primary w-100 shadow-primary">Update Person</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* Suspect Modal */}
            {showSuspectModal && (
                <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)', zIndex: 2100 }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <form onSubmit={submitSuspect} className="modal-content bg-panel text-light border-danger shadow-lg">
                            <div className="modal-header border-bottom border-danger"><h5 className="modal-title fw-bold text-danger"><i className="fas fa-user-slash me-2"></i> Register Suspect for Live Detection</h5><button type="button" className="btn-close btn-close-white" onClick={() => setShowSuspectModal(false)}></button></div>
                            <div className="modal-body p-4">
                                <div className="alert alert-danger border-danger bg-danger bg-opacity-9 small mb-4"><i className="fas fa-exclamation-triangle me-2"></i><strong>Warning:</strong> When this person is detected on camera, an <strong>emergency alert</strong> will be triggered automatically.</div>
                                {suspectMsg.text && <div className={`alert alert-${suspectMsg.type} mb-3`}>{suspectMsg.text}</div>}
                                <div className="row g-4">
                                    <div className="col-md-4 d-flex flex-column align-items-center">
                                        <div className="border border-danger border-2 rounded-3 overflow-hidden mb-3 bg-dark d-flex align-items-center justify-content-center" style={{ width: '100%', height: 200 }}>
                                            {suspectPreview ? <img src={suspectPreview} className="w-100 h-100 object-fit-cover" alt="Preview" /> : <div className="text-center text-secondary"><i className="fas fa-id-card fa-3x mb-2 text-danger opacity-50"></i><p className="small mb-0">Face Photo</p><p className="small text-danger">Required</p></div>}
                                        </div>
                                        <label className="btn btn-outline-danger w-100 btn-sm"><i className="fas fa-upload me-2"></i> Choose Photo<input type="file" accept="image/*" className="d-none" onChange={handleSuspectPhotoChange} required /></label>
                                    </div>
                                    <div className="col-md-8">
                                        <div className="mb-3"><label className="form-label text-danger small fw-bold">Full Name <span className="text-danger">*</span></label><input className="form-control bg-dark border-secondary text-white" placeholder="Suspect's full name" value={suspectForm.name} onChange={e => setSuspectForm({ ...suspectForm, name: e.target.value })} required /></div>
                                        <div className="mb-3"><label className="form-label text-secondary small">Phone / ID</label><input className="form-control bg-dark border-secondary text-white" placeholder="Optional contact or ID number" value={suspectForm.phone} onChange={e => setSuspectForm({ ...suspectForm, phone: e.target.value })} /></div>
                                        <div className="mb-3"><label className="form-label text-secondary small">Last Known Address</label><input className="form-control bg-dark border-secondary text-white" placeholder="Optional address" value={suspectForm.address} onChange={e => setSuspectForm({ ...suspectForm, address: e.target.value })} /></div>
                                        <div className="mb-3"><label className="form-label text-secondary small">Notes / Reason</label><textarea className="form-control bg-dark border-secondary text-white" rows={3} placeholder="Why is this person flagged as a suspect?" value={suspectForm.notes} onChange={e => setSuspectForm({ ...suspectForm, notes: e.target.value })} /></div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer border-top border-danger d-flex gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => setShowSuspectModal(false)}>Cancel</button><button type="submit" className="btn btn-danger fw-bold px-4" disabled={suspectLoading || !suspectPhoto || !suspectForm.name}>{suspectLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Registering...</> : <><i className="fas fa-shield-alt me-2"></i>Register Suspect</>}</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
