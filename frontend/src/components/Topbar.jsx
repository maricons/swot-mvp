// src/components/Topbar.jsx
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../utils/format';

const LINKS = {
    orders: { path: '/orders', text: 'Órdenes' },
    fleet: { path: '/fleet', text: 'Flota' },
    otif: { path: '/otif', text: 'OTIF' },
    predictions: { path: '/predictions', text: 'Predicciones' },
    containers: { path: '/containers', text: 'Contenedores' },
    billing: { path: '/billing', text: 'Cobros' },
    customers: { path: '/customers', text: 'Clientes' },
    vehicles: { path: '/vehicles', text: 'Vehículos' },
    drivers: { path: '/drivers', text: 'Conductores' },
    products: { path: '/products', text: 'Productos' },
};

// Management sees everything, grouped so the bar stays short: one drop-down per area.
// Roles with only a couple of screens get plain links.
const MANAGEMENT = [
    { label: '🚚 Transporte', items: ['orders', 'fleet', 'otif', 'predictions'] },
    { label: '📦 Almacenaje', items: ['containers', 'billing'] },
    { label: '📋 Catálogos', items: ['customers', 'vehicles', 'drivers', 'products'] },
];
const MENU = {
    dispatcher: ['orders', 'predictions'],
    driver: [],
    supervisor: MANAGEMENT,
    admin: MANAGEMENT,
    yard: ['containers'],
};

function Topbar() {
    const [open, setOpen] = useState(false); // mobile menu
    const [group, setGroup] = useState(null); // drop-down open on desktop
    const barRef = useRef(null);
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const role = localStorage.getItem('role');
    const menu = MENU[role] || [];

    // Any click outside the bar closes the drop-down
    useEffect(() => {
        const close = (e) => barRef.current && !barRef.current.contains(e.target) && setGroup(null);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const logout = () => {
        localStorage.clear();
        navigate('/');
    };

    const link = (key) => (
        <NavLink key={key} to={LINKS[key].path} onClick={() => { setOpen(false); setGroup(null); }}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-activo' : ''}`}>
            {LINKS[key].text}
        </NavLink>
    );

    return (
        <header className="topbar" ref={barRef}>
            <div className="topbar-inner">
                <div className="brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>

                <nav className={`nav ${open ? 'nav-open' : ''}`}>
                    {menu.map((entry) => {
                        if (typeof entry === 'string') return link(entry);
                        const here = entry.items.some((key) => LINKS[key].path === pathname);
                        return (
                            <div key={entry.label} className={`nav-group ${group === entry.label ? 'nav-group-open' : ''}`}>
                                <button type="button" className={`nav-link nav-trigger ${here ? 'nav-activo' : ''}`}
                                    aria-expanded={group === entry.label}
                                    onClick={() => setGroup(group === entry.label ? null : entry.label)}>
                                    {entry.label} <span className="caret">▾</span>
                                </button>
                                <span className="nav-heading">{entry.label}</span>
                                <div className="nav-menu">{entry.items.map(link)}</div>
                            </div>
                        );
                    })}
                    {/* Inside the mobile menu the session controls live here */}
                    <div className="nav-user">
                        <span className="role-chip">{ROLE_LABELS[role]}</span>
                        <button className="btn btn-sm" onClick={logout}>Cerrar sesión</button>
                    </div>
                </nav>

                <div className="user-box">
                    <span className="role-chip">{ROLE_LABELS[role]}</span>
                    <button className="btn btn-sm" onClick={logout}>Salir</button>
                </div>

                <button className={`hamburger ${open ? 'hamburger-open' : ''}`} aria-label="Menú"
                    aria-expanded={open} onClick={() => setOpen(!open)}>
                    <span /><span /><span />
                </button>
            </div>
        </header>
    );
}

export default Topbar;
