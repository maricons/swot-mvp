// src/pages/Fleet.jsx
import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import MapView from '../components/MapView';
import { useToast } from '../components/Toast';

const REFRESH_MS = 20000;
const STALE_SECONDS = 600; // a position older than 10 minutes is shown as outdated

// "hace 45 s", "hace 3 min", "hace 2 h"
const ago = (seconds) => {
    if (seconds < 60) return `hace ${seconds} s`;
    if (seconds < 3600) return `hace ${Math.round(seconds / 60)} min`;
    return `hace ${Math.round(seconds / 3600)} h`;
};

// Where the trucks in transit are: the last position each driver's phone reported, and the customer they are heading to
function Fleet() {
    const [trucks, setTrucks] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);
    const toast = useToast();

    // Loads now and every 20 seconds while the page is open
    useEffect(() => {
        const load = () => api.get('/fleet')
            .then((res) => {
                setTrucks(res.data);
                setUpdatedAt(new Date());
            })
            .catch(() => toast('No se pudo actualizar la flota', 'error'));
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    }, [toast]);

    const markers = useMemo(() => (trucks || []).flatMap((t) => [
        ...(t.position ? [{
            id: `truck-${t.orderId}`,
            latitude: t.position.latitude,
            longitude: t.position.longitude,
            label: '🚚',
            tone: t.position.secondsAgo > STALE_SECONDS ? 'stale' : 'truck',
            title: `${t.plate || 'Camión'} · ${t.driverName}`,
            lines: [`OT #${t.orderId} hacia ${t.customerName}`, `Última señal ${ago(t.position.secondsAgo)}`],
        }] : []),
        ...(t.destination ? [{
            id: `stop-${t.orderId}`,
            latitude: t.destination.latitude,
            longitude: t.destination.longitude,
            label: '📍',
            tone: 'stop',
            title: t.customerName,
            lines: [t.customerAddress, `OT #${t.orderId} · ${t.driverName}`],
        }] : []),
    ]), [trucks]);

    const paths = useMemo(() => (trucks || [])
        .filter((t) => t.position && t.destination)
        .map((t) => [[t.position.latitude, t.position.longitude], [t.destination.latitude, t.destination.longitude]]), [trucks]);

    const withSignal = (trucks || []).filter((t) => t.position && t.position.secondsAgo <= STALE_SECONDS).length;
    const tiles = [
        ['Camiones en ruta', trucks?.length],
        ['Con señal', trucks && withSignal],
        ['Sin señal reciente', trucks && trucks.length - withSignal],
    ];

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <h1 className="page-title">Flota en ruta</h1>
                    <p className="page-sub">
                        Camiones con una OT en ruta, con la última ubicación que informó el celular de cada conductor.
                        {updatedAt && ` Actualizado a las ${updatedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}; se refresca solo.`}
                    </p>
                </Reveal>

                <div className="stats stats-fleet">
                    {tiles.map(([label, value], i) => (
                        <Reveal key={label} delay={100 + i * 90}>
                            <div className="stat">
                                {value == null ? <span className="skeleton sk-num" /> : <div className="stat-num">{value}</div>}
                                <div className="stat-label">{label}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Reveal delay={150}>
                    <section className="card">
                        <MapView markers={markers} paths={paths} height={420} />
                        <p className="hint map-note">
                            🚚 camión · 📍 destino · una línea une cada camión con su cliente. Un camión gris no informa hace más de 10 minutos.
                        </p>
                    </section>
                </Reveal>

                <Reveal delay={200}>
                    <section className="card">
                        <h2 className="card-title">Camiones</h2>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr><th>Camión</th><th>Conductor</th><th>OT</th><th>Destino</th><th>Última señal</th></tr>
                                </thead>
                                <tbody>
                                    {(trucks || []).map((t) => (
                                        <tr key={t.orderId}>
                                            <td><strong>{t.plate || '—'}</strong></td>
                                            <td>{t.driverName}</td>
                                            <td className="id-cell">#{t.orderId}</td>
                                            <td>{t.customerName}{!t.destination && <div className="hint">sin ubicación en el mapa</div>}</td>
                                            <td className={t.position && t.position.secondsAgo <= STALE_SECONDS ? '' : 'text-late'}>
                                                {t.position ? ago(t.position.secondsAgo) : 'sin señal'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {trucks && trucks.length === 0 && <div className="empty">No hay camiones en ruta en este momento.</div>}
                        </div>
                    </section>
                </Reveal>
            </main>
        </>
    );
}

export default Fleet;
