import React from 'react';

const Help = () => {
    return (
        <div className="container-fluid p-4 animate-fade-in h-100 overflow-auto">
            <h2 className="mb-4 fw-bold text-uppercase border-bottom border-secondary pb-3">
                <i className="fas fa-question-circle me-2 text-warning"></i> Help & Support
            </h2>

            <div className="accordion" id="helpAccordion">
                {/* Item 1 */}
                <div className="accordion-item bg-panel border-secondary mb-2">
                    <h2 className="accordion-header">
                        <button className="accordion-button collapsed bg-panel text-light shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne">
                            <i className="fas fa-camera me-2 text-primary"></i> How do I add a new camera?
                        </button>
                    </h2>
                    <div id="collapseOne" className="accordion-collapse collapse" data-bs-parent="#helpAccordion">
                        <div className="accordion-body text-secondary">
                            Navigate to the Dashboard and click the green <strong>"Add Camera"</strong> button on the right sidebar. Select the available device from the dropdown and give it a label.
                        </div>
                    </div>
                </div>

                {/* Item 2 */}
                <div className="accordion-item bg-panel border-secondary mb-2">
                    <h2 className="accordion-header">
                        <button className="accordion-button collapsed bg-panel text-light shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo">
                            <i className="fas fa-user-plus me-2 text-success"></i> How to register known persons?
                        </button>
                    </h2>
                    <div id="collapseTwo" className="accordion-collapse collapse" data-bs-parent="#helpAccordion">
                        <div className="accordion-body text-secondary">
                            Go to the <strong>Admin Panel</strong>. Click "Add Person", fill in their details, and upload a clear photo. For better accuracy, use the "Register Samples" feature to add multiple angles.
                        </div>
                    </div>
                </div>

                {/* Item 3 */}
                <div className="accordion-item bg-panel border-secondary mb-2">
                    <h2 className="accordion-header">
                        <button className="accordion-button collapsed bg-panel text-light shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree">
                            <i className="fas fa-exclamation-triangle me-2 text-danger"></i> What triggers an emergency alert?
                        </button>
                    </h2>
                    <div id="collapseThree" className="accordion-collapse collapse" data-bs-parent="#helpAccordion">
                        <div className="accordion-body text-secondary">
                            Alerts are triggered by:
                            <ul>
                                <li>Detection of a known suspect.</li>
                                <li>Detection of weapons (Knives, Guns).</li>
                                <li>Violence or fighting behavior (experimental).</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Item 4 */}
                <div className="accordion-item bg-panel border-secondary mb-2">
                    <h2 className="accordion-header">
                        <button className="accordion-button collapsed bg-panel text-light shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFour">
                            <i className="fas fa-bell me-2 text-info"></i> How to manage contacts for alerts?
                        </button>
                    </h2>
                    <div id="collapseFour" className="accordion-collapse collapse" data-bs-parent="#helpAccordion">
                        <div className="accordion-body text-secondary">
                            Navigate to the <strong>Settings</strong> or <strong>Contacts</strong> page. You can add phone numbers and emails to receive notifications when an event occurs.
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-5 p-4 rounded bg-dark border border-secondary text-center">
                <h5 className="text-white mb-3">Still need help?</h5>
                <p className="text-secondary mb-4">Contact our support team for urgent assistance.</p>
                <button className="btn btn-outline-light"><i className="fas fa-envelope me-2"></i> Contact Support</button>
            </div>
        </div>
    );
};

export default Help;
