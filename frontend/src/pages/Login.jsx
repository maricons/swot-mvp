// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Login() {
    const [email, setEmail] = useState('despachador@swot.cl');
    const [password, setPassword] = useState('hash_simulado_123');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('rol', response.data.rol);
            navigate('/dashboard'); // Redirige al panel si es exitoso
        } catch (error) {
            alert('Error al iniciar sesión: ' + (error.response?.data?.error || 'Error desconocido'));
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <h2>Iniciar Sesión - SWOT</h2>
            <form onSubmit={handleLogin}>
                <div>
                    <label>Email: </label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <br />
                <div>
                    <label>Contraseña: </label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <br />
                <button type="submit">Ingresar</button>
            </form>
        </div>
    );
}

export default Login;