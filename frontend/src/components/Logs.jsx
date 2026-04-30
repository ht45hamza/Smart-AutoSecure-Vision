import React, { useState, useEffect } from 'react';
import { fetchLogs, deleteLog } from '../api';

const Logs = ({ user }) => {
    const role = user?.role || 'admin';
    const isReadOnly = role === 'owner' || role === 'security_guard';
    const ownerOnly = role === 'owner';
    const [logs, setLogs] = useState([]);
    const [selectedLog, setSelectedLog] = useState(null);
    const [filter, setFilter] = useState('All');

    useEffect(() => {
        loadLogs();
        const interval = setInterval(loadLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadLogs = async () => {
        try {
            const data = await fetchLogs();
            if (data) {
                const enriched = data.reverse().map((log, id) => {
                    let severity = 'Low';
                    let type = 'Info';

                    if (log.name === 'System') {
                        if (log.action && log.action.toLowerCase().includes('weapon')) {
                            severity = 'Critical'; type = 'Weapon';
                        } else {
                            severity = 'Medium'; type = 'System';
                        }
                    } else {
                        if (log.relation === 'Suspect') { severity = 'High'; type = 'Person'; }
                        else if (log.relation === 'Visual') { severity = 'Medium'; type = 'Person'; }
                    }
                    return { ...log, id, severity, type };
                });
                const filtered = ownerOnly ? enriched.filter(l => l.relation === 'Suspect') : enriched;
                setLogs(filtered);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteLog = async (id) => {
        if (!window.confirm("Are you sure you want to mark this as False Positive? This will remove the log.")) return;
        try {
            await deleteLog(id);
            setLogs(prev => prev.filter(l => l._id !== id));
            setSelectedLog(null);
        } catch (e) {
            alert("Failed to delete log");
        }
    };

    const exportLogs = (dataToExport, filename = 'security_report') => {
        if (!dataToExport || dataToExport.length === 0) {
            alert("No data to export");
            return;
        }

        const headers = ["Timestamp", "Date", "Time", "Name", "Relation", "Action", "Type", "Severity"];
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => [
                row.timestamp || '',
                row.date || '',
                row.time || '',
                `"${row.name || ''}"`,
                row.relation || '',
                `"${row.action || ''}"`,
                row.type || '',
                row.severity || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getSeverityBadge = (level) => {
        switch (level) {
            case 'Critical': return <span className="badge bg-danger">CRITICAL</span>;
            case 'High': return <span className="badge bg-warning text-dark">HIGH</span>;
            case 'Medium': return <span className="badge bg-info text-dark">MEDIUM</span>;
            default: return <span className="badge bg-secondary">LOW</span>;
        }
    };

    const filteredLogs = filter === 'All' ? logs : logs.filter(l => l.severity === filter || l.type === filter);

    return (
        <div className="flex-grow-1 d-flex flex-column overflow-hidden h-100 ps-0">
            <div className="p-4 overflow-auto flex-grow-1 custom-scrollbar">
                <div className="d-flex justify-content-between align-items-end mb-4 border-bottom border-secondary pb-3">
                    <div>
                        <h2 className="fw-bold text-uppercase mb-0 text-light">
                            <i className="fas fa-file-medical-alt text-primary me-2"></i> Security Logs
                        </h2>
                        <p className="text-secondary mb-0 mt-1">
                            {ownerOnly ? 'Suspect detection events for your account.' : 'Comprehensive audit trail of all detected security events.'}
                        </p>
                    </div>
                    <div className="d-flex gap-2">
                        {['All', 'Critical', 'High', 'Weapon', 'Person'].map(f => (
                            <button
                                key={f}
                                className={`btn btn-sm ${filter === f ? 'btn-primary shadow-sm' : 'btn-outline-secondary text-secondary hover-text-white'}`}
                                onClick={() => setFilter(f)}
                            >
                                {f}
                            </button>
                        ))}
                        <button 
                            className="btn btn-sm btn-outline-info shadow-sm ms-2" 
                            onClick={() => exportLogs(filteredLogs)}
                            title="Export to CSV"
                        >
                            <i className="fas fa-file-csv"></i> Export All
                        </button>
                        <button className="btn btn-sm btn-outline-light ms-2" onClick={loadLogs}>
                            <i className="fas fa-sync"></i>
                        </button>
                    </div>
                </div>

                <div className="card bg-panel border-secondary shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-dark table-hover mb-0 align-middle">
                            <thead className="bg-dark-header">
                                <tr>
                                    <th className="ps-4">Timestamp</th>
                                    <th>Severity</th>
                                    <th>Event Type</th>
                                    <th>Description</th>
                                    <th>Snapshot</th>
                                    <th className="text-end pe-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <tr key={log._id || log.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLog(log)}>
                                            <td className="ps-4 text-nowrap">
                                                <div className="fw-bold">{log.date}</div>
                                                <div className="small text-secondary">{log.time}</div>
                                            </td>
                                            <td>{getSeverityBadge(log.severity)}</td>
                                            <td>
                                                <span className={`badge border ${log.type === 'Weapon' ? 'border-danger text-danger' : 'border-info text-info'} bg-transparent`}>
                                                    {log.type.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-bold">{log.name === 'System' ? log.action : log.name}</div>
                                                <div className="small text-secondary">{log.relation}</div>
                                            </td>
                                            <td>
                                                <div style={{ width: '40px', height: '40px', overflow: 'hidden', borderRadius: '4px' }}>
                                                    <img
                                                        src={log.image?.startsWith('http') ? log.image : `/static/${log.image}`}
                                                        className="w-100 h-100 object-fit-cover shadow-sm"
                                                        alt="Thumbnail"
                                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/40?text=?'; }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="text-end pe-4">
                                                <button className="btn btn-sm btn-outline-primary shadow-sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-5 text-secondary">
                                            <i className="fas fa-inbox fa-3x mb-3 opacity-50"></i>
                                            <p>No logs found matching criteria.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedLog && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000 }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered">
                        <div className="modal-content bg-dark border-secondary text-light shadow-lg">
                            <div className="modal-header border-bottom border-secondary">
                                <h5 className="modal-title fw-bold text-uppercase">
                                    <i className="fas fa-search me-2"></i> Event Details
                                </h5>
                                <button className="btn-close btn-close-white" onClick={() => setSelectedLog(null)}></button>
                            </div>
                            <div className="modal-body p-0">
                                <div className="row g-0">
                                    <div className="col-lg-8 bg-black d-flex align-items-center justify-content-center" style={{ minHeight: '500px' }}>
                                        <img
                                            src={selectedLog.image && selectedLog.image.startsWith('http') ? selectedLog.image : `/static/${selectedLog.image}`}
                                            className="img-fluid"
                                            style={{ maxHeight: '70vh', objectFit: 'contain' }}
                                            alt="Evidence"
                                        />
                                    </div>
                                    <div className="col-lg-4 border-start border-secondary p-4 d-flex flex-column">
                                        <div className="mb-4">
                                            <div className="small text-secondary text-uppercase mb-1">Detected Threat / Entity</div>
                                            <h2 className="fw-bold mb-2">{selectedLog.name === 'System' ? selectedLog.action : selectedLog.name}</h2>
                                            <div className="d-flex gap-2">
                                                {getSeverityBadge(selectedLog.severity)}
                                                <span className="badge bg-dark border border-secondary">{selectedLog.relation}</span>
                                            </div>
                                        </div>
                                        <div className="mb-4 rounded bg-white bg-opacity-5 p-3">
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary pb-2">
                                                <span className="text-secondary"><i className="fas fa-calendar me-2"></i> Date</span>
                                                <span className="fw-bold">{selectedLog.date}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary pb-2">
                                                <span className="text-secondary"><i className="fas fa-clock me-2"></i> Time</span>
                                                <span className="fw-bold">{selectedLog.time}</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 border-bottom border-secondary pb-2">
                                                <span className="text-secondary"><i className="fas fa-tag me-2"></i> Type</span>
                                                <span>{selectedLog.type}</span>
                                            </div>
                                            <div className="d-flex justify-content-between">
                                                <span className="text-secondary"><i className="fas fa-camera me-2"></i> Source</span>
                                                <span>Camera 01 (Main)</span>
                                            </div>
                                        </div>
                                        <div className="mt-auto">
                                            <h6 className="text-uppercase text-secondary small mb-3">Recommended Actions</h6>
                                            <div className="d-grid gap-2">
                                                {selectedLog.severity === 'Critical' && (
                                                    <button className="btn btn-danger">
                                                        <i className="fas fa-bell me-2"></i> Trigger Alarm
                                                    </button>
                                                )}
                                                <button
                                                    className="btn btn-outline-light border-secondary"
                                                    onClick={() => exportLogs([selectedLog], `log_${selectedLog.name}`)}
                                                >
                                                    <i className="fas fa-share-square me-2"></i> Export Report
                                                </button>
                                                {!isReadOnly && (
                                                    <button
                                                        className="btn btn-outline-danger mt-2"
                                                        onClick={() => handleDeleteLog(selectedLog._id)}
                                                    >
                                                        <i className="fas fa-trash-alt me-2"></i> Remove Log
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Logs;