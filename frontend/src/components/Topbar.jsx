// src/components/Topbar.jsx
import { useNavigate } from 'react-router-dom';

function Topbar() {
    const navigate = useNavigate();
    const rol = localStorage.getItem('rol');

    const cerrarSesion = () => {
        localStorage.clear();
        navigate('/');
    };

    return (
        <header className="topbar">
            <div className="topbar-inner">
                <div className="brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>
                <div className="user-box">
                    <span className="role-chip">{rol}</span>
                    <button className="btn btn-sm" onClick={cerrarSesion}>Cerrar sesión</button>
                </div>
            </div>
        </header>
    );
}

export default Topbar;
