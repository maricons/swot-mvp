// src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
});

// Adds the token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// An expired or revoked session sends the user back to the login (a wrong password on the login itself does not)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
            localStorage.clear();
            // The login shows why the user was sent back
            const disabled = error.response.data?.error === 'Cuenta desactivada';
            sessionStorage.setItem('loginNotice', disabled ? 'Tu cuenta fue desactivada. Contacta al administrador.' : 'Tu sesión venció. Inicia sesión de nuevo.');
            window.location.assign('/');
        }
        return Promise.reject(error);
    }
);

export default api;
