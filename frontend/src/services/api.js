// src/services/api.js
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api'
});

// Interceptor para agregar el token a todas las peticiones
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;