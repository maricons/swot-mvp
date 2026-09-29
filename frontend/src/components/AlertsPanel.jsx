// src/components/AlertsPanel.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Reveal from './Reveal';
import { formatDay } from '../utils/format';

const MAX_ITEMS = 4;

const inspectionText = (v) => {
    if (v.daysLeft < 0) return `venció hace ${-v.daysLeft} ${v.daysLeft === -1 ? 'día' : 'días'}`;
    if (v.daysLeft === 0) return 'vence hoy';
    return `vence en ${v.daysLeft} ${v.daysLeft === 1 ? 'día' : 'días'}`;
};

// Attention list: inspections that expire within 30 days (or already did) and orders past their promised date.
// onlyVehicles hides the overdue orders (used on the vehicles page).
function AlertsPanel({ onlyVehicles = false }) {
    const [alerts, setAlerts] = useState(null);

    useEffect(() => {
        api.get('/alerts').then((res) => setAlerts(res.data)).catch(() => setAlerts(null));
    }, []);

    if (!alerts) return null;
    const vehicles = alerts.vehicles;
    const orders = onlyVehicles ? [] : alerts.overdueOrders;
    if (!vehicles.length && !orders.length) return null;

    const more = (list) => list.length > MAX_ITEMS && <li className="alert-more">y {list.length - MAX_ITEMS} más…</li>;

    return (
        <Reveal delay={80}>
            <section className="alerts">
                <h2 className="alerts-title">⚠️ Requiere atención</h2>
                <div className="alerts-grid">
                    {vehicles.length > 0 && (
                        <div>
                            <h3>Revisión técnica ({vehicles.length})</h3>
                            <ul>
                                {vehicles.slice(0, MAX_ITEMS).map((v) => (
                                    <li key={v.id}>
                                        <strong>{v.plate}</strong> {inspectionText(v)} <span className="hint">({formatDay(v.inspectionExpiry)})</span>
                                    </li>
                                ))}
                                {more(vehicles)}
                            </ul>
                        </div>
                    )}
                    {orders.length > 0 && (
                        <div>
                            <h3>OT atrasadas ({orders.length})</h3>
                            <ul>
                                {orders.slice(0, MAX_ITEMS).map((o) => (
                                    <li key={o.id}>
                                        <strong>#{o.id}</strong> {o.customerName} · {o.daysLate} {o.daysLate === 1 ? 'día' : 'días'} de atraso
                                    </li>
                                ))}
                                {more(orders)}
                            </ul>
                        </div>
                    )}
                </div>
            </section>
        </Reveal>
    );
}

export default AlertsPanel;
