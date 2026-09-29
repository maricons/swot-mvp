// src/pages/Orders.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import StatusBadge from '../components/StatusBadge';
import ScheduleModal from '../components/ScheduleModal';
import OrderDetailModal from '../components/OrderDetailModal';
import NewOrderForm from '../components/NewOrderForm';
import AlertsPanel from '../components/AlertsPanel';
import Reveal from '../components/Reveal';
import DonutChart from '../components/DonutChart';
import { useToast } from '../components/Toast';
import { STATUS_LABELS, STATUS_PLURALS, formatDate, formatDay, downloadFile } from '../utils/format';

const STATUS_COLORS = {
    Created: '#c9d3dd',
    Scheduled: '#8fa7d6',
    InTransit: '#f0cf8f',
    Delivered: '#9fd6b4',
    Failed: '#ee9f9f',
};

const EMPTY_FILTERS = { status: '', from: '', to: '' };

// Past its promised date and still open
const isLate = (order) => order.dueDate && order.dueDate < new Date().toLocaleDateString('en-CA') && !['Delivered', 'Failed'].includes(order.status);

function Orders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [version, setVersion] = useState(0); // goes up to force a reload
    const [toSchedule, setToSchedule] = useState(null);
    const [detailId, setDetailId] = useState(null);
    const toast = useToast();
    // Only the dispatcher creates and schedules; supervisor and admin follow the orders read-only
    const canOperate = localStorage.getItem('role') === 'dispatcher';

    useEffect(() => {
        api.get('/orders', { params: filters })
            .then((res) => setOrders(res.data))
            .catch(() => toast('No se pudo cargar el listado', 'error'))
            .finally(() => setLoading(false));
    }, [filters, version, toast]);

    const reload = () => setVersion((v) => v + 1);
    const changeFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

    const exportTo = async (kind) => {
        try {
            await downloadFile(api, `/orders/export/${kind}`, filters, `ordenes-${new Date().toLocaleDateString('en-CA')}.${kind === 'excel' ? 'xlsx' : 'pdf'}`);
        } catch {
            toast('No se pudo exportar el listado', 'error');
        }
    };

    const count = (status) => orders.filter((o) => o.status === status).length;

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <h1 className="page-title">Órdenes de transporte</h1>
                    <p className="page-sub">
                        {canOperate ? 'Crea, programa y haz seguimiento de cada OT.' : 'Seguimiento de las OT. Vista de solo lectura.'}
                    </p>
                </Reveal>

                <AlertsPanel />

                <div className="overview">
                    <div className="stats">
                        {[['Total en vista', orders.length], ...Object.keys(STATUS_COLORS).map((s) => [STATUS_PLURALS[s], count(s)])]
                            .map(([label, value], i) => (
                                <Reveal key={label} delay={150 + i * 90}>
                                    <div className="stat">
                                        {loading ? <span className="skeleton sk-num" /> : <div className="stat-num">{value}</div>}
                                        <div className="stat-label">{label}</div>
                                    </div>
                                </Reveal>
                            ))}
                    </div>
                    <Reveal delay={300}>
                        <DonutChart
                            title="Distribución por estado"
                            loading={loading}
                            totalLabel="OT en total"
                            data={Object.entries(STATUS_COLORS).map(([status, color]) => ({
                                label: STATUS_LABELS[status], color, count: count(status),
                            }))}
                        />
                    </Reveal>
                </div>

                {canOperate && <Reveal delay={200}><NewOrderForm onCreated={reload} /></Reveal>}

                <Reveal><section className="card">
                    <div className="card-head">
                        <h2 className="card-title">Listado</h2>
                        <div className="export-buttons">
                            <button className="btn btn-sm" onClick={() => exportTo('excel')}>⬇ Excel</button>
                            <button className="btn btn-sm" onClick={() => exportTo('pdf')}>⬇ PDF</button>
                        </div>
                    </div>

                    <div className="filters">
                        <div className="field">
                            <label>Estado</label>
                            <select className="input" name="status" value={filters.status} onChange={changeFilter}>
                                <option value="">Todos</option>
                                {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                        </div>
                        <div className="field">
                            <label>Desde</label>
                            <input className="input" type="date" name="from" value={filters.from} onChange={changeFilter} />
                        </div>
                        <div className="field">
                            <label>Hasta</label>
                            <input className="input" type="date" name="to" value={filters.to} onChange={changeFilter} />
                        </div>
                        <button className="btn btn-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar</button>
                    </div>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>OT</th>
                                    <th>Estado</th>
                                    <th>Cliente</th>
                                    <th className="num">Peso</th>
                                    <th>Compromiso</th>
                                    <th>Creada</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && [1, 2, 3, 4, 5].map((n) => (
                                    <tr key={`sk-${n}`}>
                                        {[36, 90, 130, 70, 80, 80, 110].map((w, i) => (
                                            <td key={i}><span className="skeleton sk-line" style={{ width: w }} /></td>
                                        ))}
                                    </tr>
                                ))}
                                {!loading && orders.map((order, i) => (
                                    <tr key={order.id} className="row-in" style={{ animationDelay: `${Math.min(i, 12) * 55}ms` }}>
                                        <td className="id-cell">#{order.id}</td>
                                        <td><StatusBadge status={order.status} /></td>
                                        <td>{order.customerName}</td>
                                        <td className="num">{Number(order.weightKg).toLocaleString('es-CL')} kg</td>
                                        <td className={isLate(order) ? 'text-late' : ''}>{formatDay(order.dueDate)}</td>
                                        <td>{formatDate(order.createdAt)}</td>
                                        <td className="actions">
                                            {canOperate && order.status === 'Created' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => setToSchedule(order)}>Programar</button>
                                            )}
                                            <button className="btn btn-sm" onClick={() => setDetailId(order.id)}>Detalle</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!loading && orders.length === 0 && <div className="empty">No hay órdenes con estos filtros.</div>}
                    </div>
                </section></Reveal>
            </main>

            {toSchedule && (
                <ScheduleModal
                    order={toSchedule}
                    onClose={() => setToSchedule(null)}
                    onScheduled={() => {
                        toast(`OT #${toSchedule.id} programada`);
                        setToSchedule(null);
                        reload();
                    }}
                />
            )}

            {detailId && <OrderDetailModal orderId={detailId} onClose={() => setDetailId(null)} />}
        </>
    );
}

export default Orders;
