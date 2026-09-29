// src/pages/DriverRoute.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import DeliveryModal from '../components/DeliveryModal';
import ConfirmModal from '../components/ConfirmModal';
import DriverMap from '../components/DriverMap';
import Reveal from '../components/Reveal';
import { useTruckTracking } from '../hooks/useTruckTracking';
import { useToast } from '../components/Toast';

// Opens the phone's maps app (or Google Maps) with directions to the customer: by coordinates when there are, by address otherwise
const directionsUrl = (order) => {
    const destination = order.customerLatitude != null ? `${order.customerLatitude},${order.customerLongitude}` : encodeURIComponent(order.customerAddress);
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
};

const TRACKING_MESSAGES = {
    sharing: '📡 Compartiendo tu ubicación con la central mientras estás en ruta.',
    denied: '📵 No diste permiso de ubicación: la central no verá tu camión. Actívalo en la configuración del navegador.',
    error: '📵 No se pudo obtener tu ubicación. Revisa que el GPS esté encendido.',
    unsupported: '📵 Este navegador no puede compartir la ubicación.',
};

// Mobile view of the driver: the pending orders, with the buttons to start the route and to close each delivery
function DriverRoute() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const [updating, setUpdating] = useState(null); // id of the order being changed
    const [delivering, setDelivering] = useState(null); // order whose proof of delivery is being filled in
    const [failing, setFailing] = useState(null); // order waiting for the confirmation of a failed delivery
    const toast = useToast();
    // While something is in transit the phone reports where the truck is
    const tracking = useTruckTracking(orders.some((o) => o.status === 'InTransit'));

    useEffect(() => {
        api.get('/my-route')
            .then((res) => setOrders(res.data))
            .catch(() => toast('No se pudo cargar tu hoja de ruta', 'error'))
            .finally(() => setLoading(false));
    }, [version, toast]);

    const reload = () => setVersion((v) => v + 1);

    const changeStatus = async (order, status, message) => {
        setUpdating(order.id);
        try {
            await api.patch(`/orders/${order.id}/status`, { status });
            toast(`OT #${order.id}: ${message}`);
            reload();
        } catch (error) {
            toast(error.response?.data?.error || 'No se pudo cambiar el estado', 'error');
        } finally {
            setUpdating(null);
            setFailing(null);
        }
    };

    return (
        <>
            <Topbar />
            <main className="driver-wrap">
                <Reveal>
                    <h1 className="page-title">Mi hoja de ruta</h1>
                    <p className="page-sub">Tus entregas de hoy.</p>
                </Reveal>

                {TRACKING_MESSAGES[tracking.status] && <p className={`tracking tracking-${tracking.status}`}>{TRACKING_MESSAGES[tracking.status]}</p>}
                {!loading && orders.length > 0 && <Reveal delay={100}><DriverMap orders={orders} position={tracking.position} /></Reveal>}

                <div className="driver-list">
                    {loading && [1, 2].map((n) => <span key={n} className="skeleton sk-card" />)}
                    {!loading && orders.map((order, i) => (
                        <article className="trip row-in" key={order.id} style={{ animationDelay: `${Math.min(i, 8) * 90}ms` }}>
                            <div className="trip-head">
                                <span className="trip-id">OT #{order.id}</span>
                                <StatusBadge status={order.status} />
                            </div>
                            <div className="trip-client">{order.customerName}</div>
                            <div className="trip-addr">📍 {order.customerAddress}</div>
                            <div className="trip-meta">
                                <span className="pill">{Number(order.weightKg).toLocaleString('es-CL')} kg</span>
                                {order.plate && <span className="pill">🚚 {order.plate}</span>}
                                <a className="pill pill-link" href={directionsUrl(order)} target="_blank" rel="noreferrer">🧭 Cómo llegar</a>
                            </div>

                            <div className="trip-actions">
                                {order.status === 'Scheduled' && (
                                    <button className="btn btn-primary" disabled={updating === order.id}
                                        onClick={() => changeStatus(order, 'InTransit', 'en ruta')}>
                                        Iniciar ruta
                                    </button>
                                )}
                                {order.status === 'InTransit' && (
                                    <>
                                        <button className="btn btn-success" onClick={() => setDelivering(order)}>Entregar</button>
                                        <button className="btn btn-danger" disabled={updating === order.id}
                                            onClick={() => setFailing(order)}>
                                            Fallida
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                    {!loading && orders.length === 0 && (
                        <div className="card empty">No tienes entregas pendientes. 🎉</div>
                    )}
                </div>
            </main>

            {failing && (
                <ConfirmModal
                    title={`¿Marcar la OT #${failing.id} como fallida?`}
                    message="Esto avisa que no se pudo entregar y no se puede deshacer desde tu hoja de ruta."
                    confirmText="Sí, marcar como fallida"
                    busy={updating === failing.id}
                    onConfirm={() => changeStatus(failing, 'Failed', 'fallida')}
                    onClose={() => setFailing(null)}
                />
            )}

            {delivering && (
                <DeliveryModal
                    order={delivering}
                    onClose={() => setDelivering(null)}
                    onDelivered={() => {
                        toast(`OT #${delivering.id}: entregada`);
                        setDelivering(null);
                        reload();
                    }}
                />
            )}
        </>
    );
}

export default DriverRoute;
