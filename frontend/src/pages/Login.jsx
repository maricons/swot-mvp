// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import PantallaCarga from '../components/PantallaCarga';

const PASSWORD_DEMO = 'hash_simulado_123';

function Login() {
    const [email, setEmail] = useState('despachador@swot.cl');
    const [password, setPassword] = useState(PASSWORD_DEMO);
    const [error, setError] = useState('');
    const [redirigiendo, setRedirigiendo] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        // Pasa directo a la pantalla de carga mientras se valida el login
        setRedirigiendo(true);
        const inicio = Date.now();
        try {
            const response = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('rol', response.data.rol);
            // La pantalla de carga se ve al menos 1,2 s en total, aunque la API responda rápido
            const restante = Math.max(0, 1200 - (Date.now() - inicio));
            setTimeout(() => {
                navigate(response.data.rol === 'conductor' ? '/conductor' : '/dashboard');
            }, restante);
        } catch (err) {
            // Si falla, se vuelve al formulario con el mensaje de error
            setError(err.response?.data?.error || 'No se pudo conectar con el servidor');
            setRedirigiendo(false);
        }
    };

    const usarDemo = (correo) => {
        setEmail(correo);
        setPassword(PASSWORD_DEMO);
    };

    if (redirigiendo) return <PantallaCarga mensaje="Ingresando…" />;

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="brand">
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
                </form>

                <p className="demo-label">Cuentas de prueba</p>
                <div className="demo-row">
                    <button type="button" className="btn btn-sm" onClick={() => usarDemo('despachador@swot.cl')}>Despachador</button>
                    <button type="button" className="btn btn-sm" onClick={() => usarDemo('conductor@swot.cl')}>Conductor</button>
                </div>
            </div>
        </div>
    );
}

export default Login;
