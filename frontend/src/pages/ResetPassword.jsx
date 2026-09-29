// src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

// The page the recovery email links to: /reset-password?token=...
function ResetPassword() {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        setError('');
        setSending(true);
        try {
            await api.post('/auth/reset-password', { token, password });
            setDone(true);
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="brand login-brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>

                {done ? (
                    <>
                        <p className="login-sub">✅ Tu contraseña se actualizó.</p>
                        <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>Ir a iniciar sesión</button>
                    </>
                ) : !token ? (
                    <>
                        <p className="login-sub">Este enlace no es válido. Pide uno nuevo desde «¿Olvidaste tu contraseña?».</p>
                        <button className="btn btn-primary btn-block" onClick={() => navigate('/')}>Volver</button>
                    </>
                ) : (
                    <>
                        <p className="login-sub">Elige tu nueva contraseña</p>
                        <form className="login-form" onSubmit={submit}>
                            <div className="field">
                                <label>Nueva contraseña</label>
                                <input className="input" type="password" value={password} minLength={8} maxLength={72}
                                    autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} required />
                                <span className="hint">Mínimo 8 caracteres.</span>
                            </div>
                            <div className="field">
                                <label>Repite la contraseña</label>
                                <input className="input" type="password" value={confirm} autoComplete="new-password"
                                    onChange={(e) => setConfirm(e.target.value)} required />
                            </div>
                            {error && <div className="error-box">{error}</div>}
                            <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
                                {sending ? 'Guardando…' : 'Cambiar contraseña'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

export default ResetPassword;
