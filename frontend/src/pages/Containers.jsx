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

// Second line of a card: how long it has been in the yard, when it is expected, or when it left
const footText = (c) => {
    if (c.status === 'InYard') return `${c.daysInYard} ${c.daysInYard === 1 ? 'día' : 'días'} en patio`;
    if (c.status === 'Expected') return c.expectedArrival ? `Esperado el ${formatDay(c.expectedArrival)}` : 'Sin fecha de llegada';
    return `Salió el ${formatDate(c.departedAt)}`;
};

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

    const statusChips = [
        ['', 'Todos', summary && summary.inYard + summary.expected + summary.departed],
        ['InYard', CONTAINER_STATUS_LABELS.InYard, summary?.inYard],
        ['Expected', 'Esperados', summary?.expected],
        ['Departed', 'Retirados', summary?.departed],
    ];

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
                        <div className="chips" role="tablist" aria-label="Estado">
                            {statusChips.map(([value, label, count]) => (
                                <button key={value} type="button" role="tab" aria-selected={filters.status === value}
                                    className={`chip-filter ${filters.status === value ? 'chip-filter-on' : ''}`}
                                    onClick={() => setFilters({ ...filters, status: value })}>
                                    {label}{count != null && <span className="chip-count">{count}</span>}
                                </button>
                            ))}
                        </div>

                        <div className="filters">
                            <div className="field" style={{ width: 260 }}>
                                <label>Buscar</label>
                                <input className="input" name="search" placeholder="Número, cliente, ubicación o precinto"
                                    value={filters.search} onChange={changeFilter} />
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

                        {/* One card per container: big enough to tap on a phone or a tablet. Tapping opens its screen with the actions */}
                        <div className="container-grid">
                            {loading && [1, 2, 3, 4].map((n) => <span key={n} className="skeleton cc-skeleton" />)}
                            {!loading && containers.map((c, i) => (
                                <article key={c.id} className="cc row-in" role="button" tabIndex={0}
                                    style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
                                    onClick={() => setDetailId(c.id)}
                                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setDetailId(c.id)}>
                                    <div className="cc-top">
                                        <strong className="mono cc-number">{formatContainerNumber(c.containerNumber)}</strong>
                                        <ContainerStatusBadge status={c.status} />
                                    </div>
                                    <div className="cc-customer">{c.customerName}</div>
                                    <div className="cc-tags">
                                        <span className="pill">{c.containerType}</span>
                                        {c.cargoType === 'perishable'
                                            ? <span className="pill pill-cold">❄ {c.temperatureC} °C</span>
                                            : <span className="pill">{CARGO_LABELS.dry}</span>}
                                        {c.yardLocation && <span className="pill pill-loc">📍 {c.yardLocation}</span>}
                                    </div>
                                    <div className="cc-foot">
                                        <span>{footText(c)}</span>
                                        {c.overstay ? <span className="flag">⚠ Pasado de plazo</span> : null}
                                        {c.departureOverdue ? <span className="flag">⏰ Salida vencida</span> : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                        {!loading && containers.length === 0 && <div className="empty">No hay contenedores con estos filtros.</div>}
                    </section>
                </Reveal>
            </main>

            {editing && <ContainerModal row={editing.row} onClose={() => setEditing(null)} onSaved={saved} />}
            {event && <ContainerEventModal container={event.container} kind={event.kind} onClose={() => setEvent(null)} onSaved={saved} />}
            {detailId && (
                <ContainerDetailModal
                    containerId={detailId}
                    canWrite={canWrite}
                    onClose={() => setDetailId(null)}
                    onAction={(kind, container) => {
                        setDetailId(null);
                        if (kind === 'edit') setEditing({ row: container });
                        else setEvent({ container, kind });
                    }}
                />
            )}
        </>
    );
}

export default Containers;
