// src/pages/DriverRoute.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import DeliveryModal from '../components/DeliveryModal';
import Reveal from '../components/Reveal';
import { useToast } from '../components/Toast';

// Mobile view of the driver: the pending orders, with the buttons to start the route and to close each delivery
function DriverRoute() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);
    const [updating, setUpdating] = useState(null); // id of the order being changed
    const [delivering, setDelivering] = useState(null); // order whose proof of delivery is being filled in
    const toast = useToast();

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
                                            onClick={() => changeStatus(order, 'Failed', 'fallida')}>
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
