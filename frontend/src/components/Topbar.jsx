// src/components/Topbar.jsx
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../utils/format';

const LINKS = {
    orders: { path: '/orders', text: 'Órdenes' },
    customers: { path: '/customers', text: 'Clientes' },
    vehicles: { path: '/vehicles', text: 'Vehículos' },
    drivers: { path: '/drivers', text: 'Conductores' },
    products: { path: '/products', text: 'Productos' },
    otif: { path: '/otif', text: 'OTIF' },
    containers: { path: '/containers', text: 'Contenedores' },
};

// The company sells two services: transporting cargo and storing containers.
// Each role sees the links of the services it works with (customers are shared by both).
const SERVICE_LABELS = { transport: '🚚 Transporte', storage: '📦 Almacenaje' };
const MANAGEMENT_TRANSPORT = ['orders', 'customers', 'vehicles', 'drivers', 'products', 'otif'];
const MENU = {
    dispatcher: { transport: ['orders'] },
    driver: {},
    supervisor: { transport: MANAGEMENT_TRANSPORT, storage: ['containers', 'customers'] },
    admin: { transport: MANAGEMENT_TRANSPORT, storage: ['containers', 'customers'] },
    yard: { storage: ['containers'] },
};

function Topbar() {
    const [open, setOpen] = useState(false); // mobile menu
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const role = localStorage.getItem('role');

    const menu = MENU[role] || {};
    const services = Object.keys(menu);

    // The page decides the service; the shared customers page keeps the one chosen before
    const owner = pathname === '/containers' ? 'storage' : pathname === '/customers' ? null : 'transport';
    const current = [owner, sessionStorage.getItem('service')].find((s) => services.includes(s)) || services[0];

    useEffect(() => {
        if (owner && services.includes(owner)) sessionStorage.setItem('service', owner);
    });

    const chooseService = (service) => {
        sessionStorage.setItem('service', service);
        setOpen(false);
        navigate(LINKS[menu[service][0]].path);
    };

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

    const switcher = services.length > 1 && (
        <div className="service-switch" role="tablist" aria-label="Servicio">
            {services.map((s) => (
                <button key={s} type="button" role="tab" aria-selected={s === current}
                    className={s === current ? 'service-on' : ''} onClick={() => chooseService(s)}>
                    {SERVICE_LABELS[s]}
                </button>
            ))}
        </div>
    );

    return (
        <header className="topbar">
            <div className="topbar-inner">
                <div className="brand">
                    <span className="brand-logo">🚚</span>
                    <span>SWOT</span>
                </div>

                <div className="topbar-service">{switcher}</div>

                <nav className={`nav ${open ? 'nav-open' : ''}`}>
                    <div className="nav-service">{switcher}</div>
                    {(menu[current] || []).map((key) => (
                        <NavLink key={key} to={LINKS[key].path} onClick={() => setOpen(false)}
                            className={({ isActive }) => `nav-link ${isActive ? 'nav-activo' : ''}`}>
                            {LINKS[key].text}
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
