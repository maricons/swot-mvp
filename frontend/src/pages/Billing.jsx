// src/pages/Billing.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import ContainerStatusBadge from '../components/ContainerStatusBadge';
import { useToast } from '../components/Toast';
import { CONTAINER_TYPES, downloadFile, formatContainerNumber, formatDate, formatMoney } from '../utils/format';

const EMPTY_FILTERS = { customerId: '', status: '' };
const today = () => new Date().toLocaleDateString('en-CA');

// Storage billing: every container that stayed past the free days of its type pays a daily rate.
// The tariff is at the bottom; only the admin edits it.
function Billing() {
    const [data, setData] = useState(null);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [customers, setCustomers] = useState([]);
    const [rates, setRates] = useState([]);
    const [version, setVersion] = useState(0);
    const toast = useToast();
    const isAdmin = localStorage.getItem('role') === 'admin';

    useEffect(() => {
        Promise.all([api.get('/customers'), api.get('/storage-rates')])
            .then(([c, r]) => {
                setCustomers(c.data);
                setRates(r.data);
            })
            .catch(() => toast('No se pudo cargar la tarifa', 'error'));
    }, [toast, version]);

    useEffect(() => {
        const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
        api.get('/billing', { params })
            .then((res) => setData(res.data))
            .catch(() => toast('No se pudieron cargar los cobros', 'error'));
    }, [filters, version, toast]);

    const exportFile = async (kind) => {
        const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
        try {
            await downloadFile(api, `/billing/export/${kind}`, params, `cobros-${today()}.${kind === 'excel' ? 'xlsx' : 'pdf'}`);
        } catch {
            toast('No se pudo exportar', 'error');
        }
    };

    const editRate = (type, field, value) =>
        setRates(rates.map((r) => (r.containerType === type ? { ...r, [field]: value === '' ? '' : Number(value) } : r)));

    const saveRate = async (rate) => {
        try {
            await api.put(`/storage-rates/${rate.containerType}`, { freeDays: rate.freeDays, dailyRate: rate.dailyRate });
            toast('Tarifa actualizada');
            setVersion((v) => v + 1);
        } catch (err) {
            toast(err.response?.data?.error || 'No se pudo guardar la tarifa', 'error');
        }
    };

    const loading = !data;
    const tiles = [
        ['Total a cobrar', data && formatMoney(data.total)],
        ['Subiendo en el patio', data && formatMoney(data.accruing)],
        ['Cobro cerrado (ya retirados)', data && formatMoney(data.closed)],
        ['Contenedores con cobro', data?.containers.length],
    ];

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <div className="page-head">
                        <div>
                            <h1 className="page-title">Cobros de almacenaje</h1>
                            <p className="page-sub">
                                Cada contenedor incluye unos días libres según su tipo; después se cobra una tarifa por cada día en el patio.
                                Los que siguen adentro suman un día más cada jornada.
                            </p>
                        </div>
                        <div className="actions">
                            <button className="btn" onClick={() => exportFile('excel')}>⬇ Excel</button>
                            <button className="btn" onClick={() => exportFile('pdf')}>⬇ PDF</button>
                        </div>
                    </div>
                </Reveal>

                <div className="stats">
                    {tiles.map(([label, value], i) => (
                        <Reveal key={label} delay={100 + i * 90}>
                            <div className="stat">
                                {loading ? <span className="skeleton sk-num" /> : <div className="stat-num">{value}</div>}
                                <div className="stat-label">{label}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>

                <Reveal>
                    <section className="card">
                        <div className="filters">
                            <div className="field">
                                <label>Cliente</label>
                                <select className="input" value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}>
                                    <option value="">Todos</option>
                                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="field">
                                <label>Contenedores</label>
                                <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                                    <option value="">Todos</option>
                                    <option value="InYard">En patio (subiendo)</option>
                                    <option value="Departed">Retirados (cerrado)</option>
                                </select>
                            </div>
                            <button className="btn btn-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar</button>
                        </div>

                        <h2 className="card-title">Por cliente</h2>
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>Cliente</th><th>Contenedores</th><th>Días a cobrar</th><th>Cobro</th></tr></thead>
                                <tbody>
                                    {(data?.byCustomer ?? []).map((c) => (
                                        <tr key={c.customerId}>
                                            <td>{c.customerName}</td>
                                            <td className="num">{c.containers}</td>
                                            <td className="num">{c.billableDays}</td>
                                            <td className="num"><strong>{formatMoney(c.charge)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h2 className="card-title" style={{ marginTop: 24 }}>Por contenedor</h2>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr><th>Contenedor</th><th>Cliente</th><th>Tipo</th><th>Estado</th><th>Llegó</th><th>En patio</th><th>Libres</th><th>A cobrar</th><th>Cobro</th></tr>
                                </thead>
                                <tbody>
                                    {(data?.containers ?? []).map((c) => (
                                        <tr key={c.id}>
                                            <td className="mono">{formatContainerNumber(c.containerNumber)}</td>
                                            <td>{c.customerName}</td>
                                            <td>{c.containerType}</td>
                                            <td><ContainerStatusBadge status={c.status} /></td>
                                            <td>{formatDate(c.arrivedAt)}</td>
                                            <td className="num">{c.daysInYard} d</td>
                                            <td className="num">{c.freeDays} d</td>
                                            <td className="num">{c.billableDays} d × {formatMoney(c.dailyRate)}</td>
                                            <td className="num"><strong>{formatMoney(c.charge)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!loading && data.containers.length === 0 && <div className="empty">Ningún contenedor ha pasado sus días libres con estos filtros.</div>}
                        </div>
                    </section>
                </Reveal>

                <Reveal>
                    <section className="card">
                        <h2 className="card-title">Tarifa por tipo de contenedor</h2>
                        <p className="page-sub">
                            {isAdmin
                                ? 'Al cambiarla, todos los cobros se recalculan con la tarifa nueva.'
                                : 'Solo el administrador puede cambiar la tarifa.'}
                        </p>
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>Tipo</th><th>Días libres</th><th>Tarifa por día (CLP)</th>{isAdmin && <th></th>}</tr></thead>
                                <tbody>
                                    {rates.map((r) => (
                                        <tr key={r.containerType}>
                                            <td>{(CONTAINER_TYPES.find(([code]) => code === r.containerType) || [])[1]} · {r.containerType}</td>
                                            <td>
                                                {isAdmin
                                                    ? <input className="input" type="number" min="0" max="60" style={{ width: 90 }} value={r.freeDays} onChange={(e) => editRate(r.containerType, 'freeDays', e.target.value)} />
                                                    : r.freeDays}
                                            </td>
                                            <td>
                                                {isAdmin
                                                    ? <input className="input" type="number" min="0" max="1000000" step="500" style={{ width: 130 }} value={r.dailyRate} onChange={(e) => editRate(r.containerType, 'dailyRate', e.target.value)} />
                                                    : formatMoney(r.dailyRate)}
                                            </td>
                                            {isAdmin && <td className="actions"><button className="btn btn-sm" onClick={() => saveRate(r)}>Guardar</button></td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </Reveal>
            </main>
        </>
    );
}

export default Billing;
