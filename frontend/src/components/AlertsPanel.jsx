// src/components/AlertsPanel.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Reveal from './Reveal';
import { formatContainerNumber, formatDay } from '../utils/format';

const MAX_ITEMS = 4;

const days = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

const inspectionText = (v) => {
    if (v.daysLeft < 0) return `venció hace ${days(-v.daysLeft)}`;
    if (v.daysLeft === 0) return 'vence hoy';
    return `vence en ${days(v.daysLeft)}`;
};

// Attention list. sections picks what to show: "vehicles" and "orders" (transport) or "containers" (storage).
// version changes when the page reloads its data, so the alerts refresh too.
function AlertsPanel({ sections = ['vehicles', 'orders'], version = 0 }) {
    const [alerts, setAlerts] = useState(null);

    useEffect(() => {
        api.get('/alerts').then((res) => setAlerts(res.data)).catch(() => setAlerts(null));
    }, [version]);

    if (!alerts) return null;

    const blocks = [
        ['vehicles', 'Revisión técnica', alerts.vehicles, (v) => (
            <><strong>{v.plate}</strong> {inspectionText(v)} <span className="hint">({formatDay(v.inspectionExpiry)})</span></>
        )],
        ['orders', 'OT atrasadas', alerts.overdueOrders, (o) => (
            <><strong>#{o.id}</strong> {o.customerName} · {days(o.daysLate)} de atraso</>
        )],
        ['containers', `Contenedores con más de ${alerts.freeDays} días en patio`, alerts.overstayContainers, (c) => (
            <><strong>{formatContainerNumber(c.containerNumber)}</strong> {c.customerName} · {days(c.daysInYard)} en {c.yardLocation}</>
        )],
        ['containers', 'Salida prevista vencida', alerts.overdueContainers, (c) => (
            <><strong>{formatContainerNumber(c.containerNumber)}</strong> {c.customerName} · {days(c.daysLate)} de atraso</>
        )],
    ].filter(([section, , items]) => sections.includes(section) && items.length > 0);

    if (!blocks.length) return null;

    return (
        <Reveal delay={80}>
            <section className="alerts">
                <h2 className="alerts-title">⚠️ Requiere atención</h2>
                <div className="alerts-grid">
                    {blocks.map(([section, title, items, render]) => (
                        <div key={`${section}-${title}`}>
                            <h3>{title} ({items.length})</h3>
                            <ul>
                                {items.slice(0, MAX_ITEMS).map((item) => <li key={item.id}>{render(item)}</li>)}
                                {items.length > MAX_ITEMS && <li className="alert-more">y {items.length - MAX_ITEMS} más…</li>}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>
        </Reveal>
    );
}

export default AlertsPanel;
