// src/pages/Login.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { homeRoute } from '../utils/format';

const DEMO_PASSWORD = 'hash_simulado_123';
const DEMO_ACCOUNTS = [
    ['Despachador', 'despachador@swot.cl'],
    ['Conductor', 'conductor@swot.cl'],
    ['Supervisor', 'supervisor@swot.cl'],
    ['Patio', 'patio@swot.cl'],
    ['Admin', 'admin@swot.cl'],
];
const MIN_SPLASH_MS = 1200;

function Login() {
    const [email, setEmail] = useState('despachador@swot.cl');
    const [password, setPassword] = useState(DEMO_PASSWORD);
    // The notice comes from the interceptor when a session expired or the account was deactivated
    const [error, setError] = useState(() => sessionStorage.getItem('loginNotice') || '');
    const [loggingIn, setLoggingIn] = useState(false);
    const [flipped, setFlipped] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState('');
    const [resetSending, setResetSending] = useState(false);
    const navigate = useNavigate();

    // Show the notice once: it is cleared after the first render
    useEffect(() => sessionStorage.removeItem('loginNotice'), []);

    // Asks the server to email a recovery link. The answer is the same whether the email is registered or not
    const handleReset = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSending(true);
        try {
            await api.post('/auth/forgot-password', { email: resetEmail });
            setResetSent(true);
        } catch (err) {
            setResetError(err.response?.data?.error || 'No se pudo enviar la solicitud');
        } finally {
            setResetSending(false);
        }
    };

    const flip = (toBack) => {
        setFlipped(toBack);
        if (!toBack) {
            setResetSent(false);
            setResetError('');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        // Goes straight to the loading screen while the login is checked
        setLoggingIn(true);
        const startedAt = Date.now();
        try {
            const { data } = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            // The loading screen stays at least MIN_SPLASH_MS in total, even if the API answers fast
            setTimeout(() => navigate(homeRoute(data.role)), Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAt)));
        } catch (err) {
            // On failure it goes back to the form with the error message
            setError(err.response?.data?.error || 'No se pudo conectar con el servidor');
            setLoggingIn(false);
        }
    };

    const pickDemo = (mail) => {
        setEmail(mail);
        setPassword(DEMO_PASSWORD);
    };

    if (loggingIn) {
        return (
            <div className="splash" role="status">
                <div className="spinner" />
                <p>Ingresando…</p>
            </div>
        );
    }

    return (
        <div className="login-page">
          <div className={`flip ${flipped ? 'flip-on' : ''}`}>
            <div className="flip-face login-card" inert={flipped}>
                <div className="brand login-brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>
                <p className="login-sub">Gestión de órdenes de transporte</p>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="field">
                        <label>Correo</label>
                        <input className="input" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="field">
                        <label>Contraseña</label>
                        <input className="input" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {error && <div className="error-box">{error}</div>}
                    <button className="btn btn-primary btn-block" type="submit">Ingresar</button>
                    <button type="button" className="link-btn" onClick={() => flip(true)}>¿Olvidaste tu contraseña?</button>
                </form>

                <div className="demo-row">
                    <span className="demo-label">Probar como</span>
                    {DEMO_ACCOUNTS.map(([label, mail]) => (
                        <button key={mail} type="button" className={`chip ${email === mail ? 'chip-on' : ''}`} onClick={() => pickDemo(mail)}>{label}</button>
                    ))}
                </div>
            </div>

            <div className="flip-face flip-back login-card" inert={!flipped}>
                <div className="brand login-brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>

                <div className="reset-main">
                    <span className="reset-icon">{resetSent ? '✅' : '✉️'}</span>
                    <h2 className="reset-title">{resetSent ? '¡Revisa tu correo!' : '¿Olvidaste tu contraseña?'}</h2>

                    {resetSent ? (
                        <p className="reset-note">
                            Si <strong>{resetEmail}</strong> está registrado, te enviamos un correo con un enlace para restablecer tu contraseña. Vence en 30 minutos.
                        </p>
                    ) : (
                        <>
                            <p className="reset-text">Ingresa tu correo y te enviaremos un correo con el detalle.</p>
                            <form className="login-form" onSubmit={handleReset}>
                                <div className="field">
                                    <label>Correo</label>
                                    <input className="input" type="email" value={resetEmail}
                                        onChange={(e) => setResetEmail(e.target.value)} required />
                                </div>
                                {resetError && <div className="error-box">{resetError}</div>}
                                <button className="btn btn-light btn-block" type="submit" disabled={resetSending}>
                                    {resetSending ? 'Enviando…' : 'Enviar'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <button type="button" className="link-btn" onClick={() => flip(false)}>← Volver a iniciar sesión</button>
            </div>
          </div>
        </div>
    );
}

export default Login;
