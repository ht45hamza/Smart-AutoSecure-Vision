import React, { useState } from 'react';
import { apiLogin, apiRegister, apiVerifyOtp, apiGoogleLogin, apiForgotPassword } from '../api';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = "175235397160-bj1g53f49unppillu2rbgn3m82fbad4m.apps.googleusercontent.com"; // User's Client ID

const Login = ({ onLoginSuccess }) => {
    const [view, setView] = useState('login'); // 'login', 'register', 'verify', 'forgot1', 'forgot2'
    const [formData, setFormData] = useState({ name: '', email: '', password: '', otp: '' });
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        setIsLoading(true);

        try {
            if (view === 'register') {
                const res = await apiRegister(formData.name, formData.email, formData.password);
                if (res.success) {
                    setMsg({ type: 'success', text: res.message });
                    setTimeout(() => setView('verify'), 1500);
                } else {
                    setMsg({ type: 'danger', text: res.message || "Registration failed" });
                }
            } else if (view === 'verify') {
                const res = await apiVerifyOtp(formData.email, formData.otp);
                if (res.success) {
                    setMsg({ type: 'success', text: 'Email Verified! Redirecting to login...' });
                    setTimeout(() => {
                        setView('login');
                        setFormData({ ...formData, password: '', otp: '' });
                    }, 1500);
                } else {
                    setMsg({ type: 'danger', text: res.message || "Verification failed" });
                }
            } else if (view === 'forgot1') {
                const res = await apiForgotPassword(1, formData.email);
                if (res.success) {
                    setMsg({ type: 'success', text: res.message });
                    setView('forgot2');
                } else {
                    setMsg({ type: 'danger', text: res.message || "Failed to send reset code" });
                }
            } else if (view === 'forgot2') {
                const res = await apiForgotPassword(2, formData.email, formData.otp, formData.password);
                if (res.success) {
                    setMsg({ type: 'success', text: res.message });
                    setTimeout(() => {
                        setView('login');
                        setFormData({ ...formData, password: '', otp: '' });
                    }, 1500);
                } else {
                    setMsg({ type: 'danger', text: res.message || "Failed to reset password" });
                }
            } else {
                const res = await apiLogin(formData.email, formData.password);
                if (res.success) {
                    setMsg({ type: 'success', text: 'Login Successful!' });
                    if (onLoginSuccess) onLoginSuccess(res.user);
                } else {
                    setMsg({ type: 'danger', text: res.message || "Login failed" });
                }
            }
        } catch (e) {
            console.error(e);
            setMsg({ type: 'danger', text: "Connection Error: Backend may be unreachable." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const res = await apiGoogleLogin(credentialResponse.credential);
            if (res.success) {
                setMsg({ type: 'success', text: 'Google Login Successful!' });
                if (onLoginSuccess) onLoginSuccess(res.user);
            } else {
                setMsg({ type: 'danger', text: res.message });
            }
        } catch (error) {
            setMsg({ type: 'danger', text: "Google Authentication Error" });
        }
    };

    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <div className="d-flex align-items-center justify-content-center bg-dark-theme" style={{ minHeight: '100vh', background: 'radial-gradient(circle at center, #1b2735 0%, #090a0f 100%)' }}>
                <div className="card bg-panel text-white border-dark p-4 shadow-lg animate-fade-in" style={{ width: '420px', borderRadius: '16px', backdropFilter: 'blur(10px)', backgroundColor: 'rgba(20, 25, 35, 0.85)' }}>
                    <div className="card-body p-2">
                        <div className="text-center mb-4">
                            <div className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle mb-3 glow-primary" style={{ width: '60px', height: '60px' }}>
                                <i className="fas fa-shield-alt fa-2x"></i>
                            </div>
                            <h3 className="card-title fw-bold tracking-wide">
                                {view === 'register' ? 'Create Account' :
                                    view === 'verify' ? 'Verify Email' :
                                        view === 'forgot1' ? 'Reset Password' :
                                            view === 'forgot2' ? 'Set New Password' :
                                                'Welcome Back'}
                            </h3>
                            <p className="text-secondary small mt-1">Smart AutoSecure Vision Portal</p>
                        </div>

                        {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

                        <form onSubmit={handleSubmit}>
                            {/* REGISTER NAME FIELD */}
                            {view === 'register' && (
                                <div className="mb-3">
                                    <label className="form-label text-secondary small text-uppercase fw-bold">Full Name</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-black border-dark text-secondary"><i className="fas fa-user"></i></span>
                                        <input
                                            type="text"
                                            className="form-control bg-black border-dark text-white shadow-none focus-ring-primary"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="John Doe"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {/* EMAIL FIELD (Visible in login, register, and forgot1) */}
                            {['login', 'register', 'forgot1'].includes(view) && (
                                <div className="mb-3">
                                    <label className="form-label text-secondary small text-uppercase fw-bold">Email Address</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-black border-dark text-secondary"><i className="fas fa-envelope"></i></span>
                                        <input
                                            type="email"
                                            className="form-control bg-black border-dark text-white shadow-none focus-ring-primary"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="you@domain.com"
                                            required
                                            disabled={view === 'forgot2'}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* PASSWORD FIELD (Visible in login, register, and forgot2) */}
                            {['login', 'register', 'forgot2'].includes(view) && (
                                <div className="mb-4">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <label className="form-label text-secondary small text-uppercase fw-bold mb-0">
                                            {view === 'forgot2' ? 'New Password' : 'Password'}
                                        </label>
                                        {view === 'login' && (
                                            <button type="button" className="btn btn-link p-0 text-decoration-none small text-primary opacity-75 hover-opacity-100" onClick={() => setView('forgot1')}>Forgot?</button>
                                        )}
                                    </div>
                                    <div className="input-group">
                                        <span className="input-group-text bg-black border-dark text-secondary"><i className="fas fa-lock"></i></span>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="form-control bg-black border-dark text-white shadow-none focus-ring-primary border-end-0"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="input-group-text bg-black border-dark text-secondary border-start-0 hover-text-white transition-colors"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* OTP FIELD (Visible in verify and forgot2) */}
                            {['verify', 'forgot2'].includes(view) && (
                                <div className="mb-4">
                                    <label className="form-label text-secondary small text-uppercase fw-bold text-center w-100">
                                        Enter 6-Digit OTP sent to {formData.email}
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control bg-black border-dark text-white shadow-none text-center tracking-widest fw-bold fs-4 py-3"
                                        value={formData.otp}
                                        onChange={e => setFormData({ ...formData, otp: e.target.value })}
                                        required
                                        maxLength="6"
                                        placeholder="• • • • • •"
                                        style={{ letterSpacing: '8px' }}
                                    />
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary w-100 fw-bold py-2 shadow-lg mb-3 d-flex align-items-center justify-content-center gap-2" disabled={isLoading}>
                                {isLoading ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : null}
                                {view === 'register' ? 'Complete Registration' :
                                    view === 'verify' ? 'Verify Identity' :
                                        view === 'forgot1' ? 'Send Reset Link' :
                                            view === 'forgot2' ? 'Update Password' :
                                                'Secure Sign In'}
                            </button>
                        </form>

                        {view === 'login' && (
                            <>
                                <div className="position-relative my-4">
                                    <hr className="border-secondary opacity-25" />
                                    <span className="position-absolute top-50 start-50 translate-middle bg-panel px-3 small text-secondary">OR</span>
                                </div>
                                <div className="mb-3 d-flex justify-content-center text-center w-100">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => setMsg({ type: 'danger', text: "Google Authentication Failed" })}
                                        useOneTap
                                        theme="filled_black"
                                        shape="pill"
                                        width="100%"
                                        text="continue_with"
                                    />
                                </div>
                            </>
                        )}

                        <div className="mt-3 text-center">
                            {['login', 'register'].includes(view) && (
                                <button
                                    className="btn btn-link text-decoration-none text-secondary hover-text-white transition-all small"
                                    onClick={() => {
                                        setMsg({ type: '', text: '' });
                                        setView(view === 'login' ? 'register' : 'login');
                                    }}
                                >
                                    {view === 'register' ? 'Already have an account? Log in' : "Don't have an account? Register"}
                                </button>
                            )}
                            {['verify', 'forgot1', 'forgot2'].includes(view) && (
                                <button
                                    className="btn btn-link text-decoration-none text-secondary hover-text-white transition-all small"
                                    onClick={() => {
                                        setMsg({ type: '', text: '' });
                                        setView('login');
                                    }}
                                >
                                    <i className="fas fa-arrow-left me-1"></i> Back to Login
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    );
};

export default Login;
