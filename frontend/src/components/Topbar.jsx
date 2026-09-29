// src/components/Topbar.jsx
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../utils/format';

const MANAGEMENT_LINKS = [
    { path: '/orders', text: 'Órdenes' },
    { path: '/customers', text: 'Clientes' },
    { path: '/vehicles', text: 'Vehículos' },
    { path: '/drivers', text: 'Conductores' },
    { path: '/products', text: 'Productos' },
    { path: '/otif', text: 'OTIF' },
];

// Screens visible for each role
const LINKS = {
    dispatcher: [{ path: '/orders', text: 'Órdenes' }],
    supervisor: MANAGEMENT_LINKS,
    admin: MANAGEMENT_LINKS,
    driver: [],
};

function Topbar() {
    const [open, setOpen] = useState(false); // mobile menu
    const navigate = useNavigate();
    const role = localStorage.getItem('role');

    const logout = () => {
        localStorage.clear();
        navigate('/');
    };

    const userBox = (
        <>
            <span className="role-chip">{ROLE_LABELS[role]}</span>
            <button className="btn btn-sm" onClick={logout}>Cerrar sesión</button>
        </>
    );

    return (
        <header className="topbar">
            <div className="topbar-inner">
                <div className="brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>

                <nav className={`nav ${open ? 'nav-open' : ''}`}>
                    {(LINKS[role] || []).map((l) => (
                        <NavLink key={l.path} to={l.path} onClick={() => setOpen(false)}
                            className={({ isActive }) => `nav-link ${isActive ? 'nav-activo' : ''}`}>
                            {l.text}
                        </NavLink>
                    ))}
                    {/* Inside the mobile menu the session controls live here */}
                    <div className="nav-user">{userBox}</div>
                </nav>

                <div className="user-box">{userBox}</div>

                <button className={`hamburger ${open ? 'hamburger-open' : ''}`} aria-label="Menú"
                    aria-expanded={open} onClick={() => setOpen(!open)}>
                    <span /><span /><span />
                </button>
            </div>
        </header>
    );
}

export default Topbar;
