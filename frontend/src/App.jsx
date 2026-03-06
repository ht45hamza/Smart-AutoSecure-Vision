import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Login from './components/Login';

const App = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        // Check local storage for persistent login session across reloads
        const storedUser = localStorage.getItem('autosecure_user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
        }
    }, []);

    const handleLoginSuccess = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('autosecure_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('autosecure_user');
        // You can also hit a backend logout endpoint if fully migrating to React API
    };

    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    // Pass user and a way to logout to the Dashboard 
    // Assuming Dashboard can accept these props if we want to show user info
    return <Dashboard user={user} onLogout={handleLogout} />;
};

export default App;
