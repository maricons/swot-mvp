// src/pages/Containers.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import DonutChart from '../components/DonutChart';
import AlertsPanel from '../components/AlertsPanel';
import ContainerStatusBadge from '../components/ContainerStatusBadge';
import ContainerModal from '../components/ContainerModal';
import ContainerEventModal from '../components/ContainerEventModal';
import ContainerDetailModal from '../components/ContainerDetailModal';
import { useToast } from '../components/Toast';
import { CARGO_LABELS, CONTAINER_STATUS_LABELS, formatContainerNumber, formatDate, formatDay } from '../utils/format';

const STATUS_COLORS = { InYard: '#9fd6b4', Expected: '#8fa7d6', Departed: '#c9d3dd' };
const EMPTY_FILTERS = { status: '', cargoType: '', search: '' };

// Container storage: what is in the yard, what is coming and what already left, with the actions to record each movement
function Containers() {
    const [containers, setContainers] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [version, setVersion] = useState(0);
    const [editing, setEditing] = useState(null); // null = closed, {} = announce, { row } = edit
    const [event, setEvent] = useState(null); // { container, kind }
    const [detailId, setDetailId] = useState(null);
    const toast = useToast();
    // The yard operator and the admin record movements; the supervisor only watches
    const canWrite = ['yard', 'admin'].includes(localStorage.getItem('role'));

    useEffect(() => {
        const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));
        Promise.all([api.get('/containers', { params }), api.get('/containers/summary')])
            .then(([list, totals]) => {
                setContainers(list.data);
                setSummary(totals.data);
            })
            .catch(() => toast('No se pudieron cargar los contenedores', 'error'))
            .finally(() => setLoading(false));
    }, [filters, version, toast]);

    const reload = () => setVersion((v) => v + 1);
    const changeFilter = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });
    const saved = (message) => {
        toast(message);
        setEditing(null);
        setEvent(null);
        reload();
    };

    const tiles = [
        ['En patio', summary?.inYard],
        ['Esperados', summary?.expected],
        ['Perecederos en patio', summary?.perishableInYard],
        ['Días promedio en patio', summary ? Number(summary.avgDaysInYard).toLocaleString('es-CL', { maximumFractionDigits: 1 }) : null],
        [`Pasados de ${summary?.freeDays ?? 5} días`, summary?.overstays],
        ['Retirados', summary?.departed],
    ];

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <div className="page-head">
                        <div>
                            <h1 className="page-title">Contenedores</h1>
                            <p className="page-sub">
                                Almacenaje de carga seca y perecedera: qué hay en el patio, qué viene en camino y qué ya salió.
                                {!canWrite && ' Vista de solo lectura.'}
                            </p>
                        </div>
                        {canWrite && <button className="btn btn-primary" onClick={() => setEditing({})}>+ Anunciar contenedor</button>}
                    </div>
                </Reveal>

                <AlertsPanel sections={['containers']} version={version} />

                <div className="overview">
                    <div className="stats">
                        {tiles.map(([label, value], i) => (
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
                            title="Contenedores por estado"
                            loading={loading}
                            totalLabel="contenedores"
                            data={Object.entries(STATUS_COLORS).map(([status, color]) => ({
                                label: CONTAINER_STATUS_LABELS[status], color,
                                count: summary ? { InYard: summary.inYard, Expected: summary.expected, Departed: summary.departed }[status] : 0,
                            }))}
                        />
                    </Reveal>
                </div>

                <Reveal>
                    <section className="card">
                        <div className="filters">
                            <div className="field" style={{ width: 240 }}>
                                <label>Buscar</label>
                                <input className="input" name="search" placeholder="Número, cliente, ubicación o precinto"
                                    value={filters.search} onChange={changeFilter} />
                            </div>
                            <div className="field">
                                <label>Estado</label>
                                <select className="input" name="status" value={filters.status} onChange={changeFilter}>
                                    <option value="">Todos</option>
                                    {Object.entries(CONTAINER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            <div className="field">
                                <label>Carga</label>
                                <select className="input" name="cargoType" value={filters.cargoType} onChange={changeFilter}>
                                    <option value="">Toda</option>
                                    {Object.entries(CARGO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                            </div>
                            <button className="btn btn-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar</button>
                        </div>

                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Contenedor</th>
                                        <th>Estado</th>
                                        <th>Cliente</th>
                                        <th>Carga</th>
                                        <th>Ubicación</th>
                                        <th>Llegada</th>
                                        <th>Salida prevista</th>
                                        <th className="num">Días</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading && [1, 2, 3, 4].map((n) => (
                                        <tr key={`sk-${n}`}>
                                            {[120, 80, 120, 90, 70, 90, 90, 30, 140].map((w, i) => (
                                                <td key={i}><span className="skeleton sk-line" style={{ width: w }} /></td>
                                            ))}
                                        </tr>
                                    ))}
                                    {!loading && containers.map((c, i) => (
                                        <tr key={c.id} className="row-in" style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}>
                                            <td>
                                                <strong className="mono">{formatContainerNumber(c.containerNumber)}</strong>
                                                <div className="hint">{c.containerType}{c.sealNumber && ` · ${c.sealNumber}`}</div>
                                            </td>
                                            <td><ContainerStatusBadge status={c.status} /></td>
                                            <td>{c.customerName}</td>
                                            <td>
                                                {c.cargoType === 'perishable'
                                                    ? <span className="cargo cargo-cold">❄ {CARGO_LABELS.perishable} · {c.temperatureC} °C</span>
                                                    : <span className="cargo">{CARGO_LABELS.dry}</span>}
                                            </td>
                                            <td className="mono">{c.yardLocation || '—'}</td>
                                            <td>{c.arrivedAt ? formatDate(c.arrivedAt) : <span className="hint">{c.expectedArrival ? `esperado ${formatDay(c.expectedArrival)}` : 'sin fecha'}</span>}</td>
                                            <td className={c.departureOverdue ? 'text-late' : ''}>{formatDay(c.plannedDeparture)}</td>
                                            <td className={`num ${c.overstay ? 'text-late' : ''}`}>{c.daysInYard ?? '—'}</td>
                                            <td className="actions">
                                                {canWrite && c.status === 'Expected' && (
                                                    <button className="btn btn-primary btn-sm" onClick={() => setEvent({ container: c, kind: 'arrive' })}>Registrar llegada</button>
                                                )}
                                                {canWrite && c.status === 'InYard' && (
                                                    <>
                                                        <button className="btn btn-sm" onClick={() => setEvent({ container: c, kind: 'move' })}>Mover</button>
                                                        <button className="btn btn-primary btn-sm" onClick={() => setEvent({ container: c, kind: 'depart' })}>Registrar salida</button>
                                                    </>
                                                )}
                                                {canWrite && c.status !== 'Departed' && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ row: c })}>Editar</button>
                                                )}
                                                <button className="btn btn-sm" onClick={() => setDetailId(c.id)}>Detalle</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {!loading && containers.length === 0 && <div className="empty">No hay contenedores con estos filtros.</div>}
                        </div>
                    </section>
                </Reveal>
            </main>

            {editing && <ContainerModal row={editing.row} onClose={() => setEditing(null)} onSaved={saved} />}
            {event && <ContainerEventModal container={event.container} kind={event.kind} onClose={() => setEvent(null)} onSaved={saved} />}
            {detailId && <ContainerDetailModal containerId={detailId} onClose={() => setDetailId(null)} />}
        </>
    );
}

export default Containers;
