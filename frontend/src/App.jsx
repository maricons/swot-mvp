// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Conductor from './pages/Conductor';
import { ToastProvider } from './components/Toast';

// Sin token va al login; con token de otro rol va a su propia pantalla
const RutaProtegida = ({ rol, children }) => {
    const token = localStorage.getItem('token');
    const rolActual = localStorage.getItem('rol');
    if (!token) return <Navigate to="/" />;
    if (rolActual !== rol) {
        return <Navigate to={rolActual === 'conductor' ? '/conductor' : '/dashboard'} />;
    }
    return children;
};

function App() {
    return (
        <ToastProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/dashboard" element={
                        <RutaProtegida rol="despachador"><Dashboard /></RutaProtegida>
                    } />
                    <Route path="/conductor" element={
                        <RutaProtegida rol="conductor"><Conductor /></RutaProtegida>
                    } />
                </Routes>
            </Router>
        </ToastProvider>
    );
}

export default App;
