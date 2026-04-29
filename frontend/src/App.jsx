import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('autosecure_user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                setUser(parsed);
                setIsAuthenticated(true);
            } catch {
                localStorage.removeItem('autosecure_user');
            }
        }
    }, []);

    const handleLoginSuccess = (userData) => {
        // Ensure role defaults to 'admin' for legacy accounts
        const normalized = {
            ...userData,
            role: userData.role || 'admin',
            admin_email: userData.admin_email || userData.email,
        };
        setUser(normalized);
        setIsAuthenticated(true);
        localStorage.setItem('autosecure_user', JSON.stringify(normalized));
    };

    const handleLogout = () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('autosecure_user');
    };

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    return <Dashboard user={user} onLogout={handleLogout} />;
};

export default App;
