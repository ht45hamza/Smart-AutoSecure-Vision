import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css';
import Dashboard from './components/Dashboard'
import Admin from './components/Admin'
import Logs from './components/Logs'
import Contacts from './components/Contacts'

import Login from './components/Login'

// Helper to mount if element exists
const mount = (id, Component) => {
    const el = document.getElementById(id);
    if (el) {
        ReactDOM.createRoot(el).render(
            <React.StrictMode>
                <Component />
            </React.StrictMode>
        );
    }
};

// Mount points
mount('dashboard-root', Dashboard);
mount('admin-root', Admin);
mount('logs-root', Logs);
mount('contacts-root', Contacts);
mount('login-root', Login);
