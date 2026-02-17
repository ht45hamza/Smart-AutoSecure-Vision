import React from 'react';

const About = () => {
    return (
        <div className="container-fluid p-4 animate-fade-in h-100 overflow-auto">
            <h2 className="mb-4 fw-bold text-uppercase border-bottom border-secondary pb-3">
                <i className="fas fa-info-circle me-2 text-primary"></i> About The Project
            </h2>

            <div className="row g-4">
                <div className="col-lg-8">
                    <div className="card shadow-sm mb-4">
                        <div className="card-body">
                            <h4 className="card-title text-primary fw-bold mb-3">Smart AutoSecure Vision™</h4>
                            <p className="card-text text-secondary mb-4">
                                Currently in <strong>Version 2.0.0 (Beta)</strong>
                            </p>
                            <p className="text-light">
                                Smart AutoSecure Vision is an advanced AI-powered surveillance system designed to enhance security through real-time automated monitoring. By leveraging state-of-the-art computer vision algorithms, it detects, recognizes, and classifies individuals and potential threats instantly.
                            </p>

                            <h5 className="mt-4 mb-3 text-white">Core Technologies</h5>
                            <ul className="list-group list-group-flush bg-transparent">
                                <li className="list-group-item bg-transparent text-secondary border-secondary"><i className="fab fa-python me-2 text-warning"></i> Python & Flask Backend</li>
                                <li className="list-group-item bg-transparent text-secondary border-secondary"><i className="fab fa-react me-2 text-info"></i> React & Vite Frontend</li>
                                <li className="list-group-item bg-transparent text-secondary border-secondary"><i className="fas fa-brain me-2 text-primary"></i> OpenCV & YOLOv8 AI Models</li>
                                <li className="list-group-item bg-transparent text-secondary border-secondary"><i className="fas fa-database me-2 text-success"></i> MongoDB Atlas Database</li>
                            </ul>
                        </div>
                    </div>

                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h5 className="card-title text-white mb-3">Developers</h5>
                            <div className="d-flex flex-column gap-3">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 40, height: 40 }}>AI</div>
                                    <div>
                                        <div className="fw-bold text-white">Abu Bakar Iqbal</div>
                                        <div className="small text-secondary">Developer</div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 40, height: 40 }}>HT</div>
                                    <div>
                                        <div className="fw-bold text-white">Hamza Tariq</div>
                                        <div className="small text-secondary">Developer</div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 40, height: 40 }}>RA</div>
                                    <div>
                                        <div className="fw-bold text-white">Rana Atif</div>
                                        <div className="small text-secondary">Developer</div>
                                    </div>
                                </div>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center text-white fw-bold" style={{ width: 40, height: 40 }}>AH</div>
                                    <div>
                                        <div className="fw-bold text-white">Ali Hassan</div>
                                        <div className="small text-secondary">Developer</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-4">
                    <div className="card shadow-sm bg-primary bg-opacity-10 border-primary border-opacity-25">
                        <div className="card-body text-center py-5">
                            <i className="fas fa-shield-alt fa-4x text-primary mb-3"></i>
                            <h4 className="fw-bold text-white">Secure. Smart. fast.</h4>
                            <p className="text-secondary small">Protecting what matters most with intelligent vision.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
