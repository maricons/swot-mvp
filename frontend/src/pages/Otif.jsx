// src/pages/Otif.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import DonutChart from '../components/DonutChart';
import BarChart from '../components/BarChart';
import { useToast } from '../components/Toast';
import { CHART, downloadFile } from '../utils/format';

const WEEKS_SHOWN = 12;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-09-01" -> "sep 2026"
const monthLabel = (period) => {
    const [year, month] = period.split('-');
    return `${MONTHS[Number(month) - 1]} ${year}`;
};

// "2026-09-21" -> "21 sep" (a week is shown by the Monday it starts)
const weekLabel = (period) => {
    const [, month, day] = period.split('-');
    return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
};

// Best and worst first: OTIF % of each driver or customer, with how many orders it is based on
const RANK_COLORS = (pct) => (pct >= 90 ? CHART.success : pct >= 70 ? CHART.warning : CHART.danger);
function Ranking({ title, rows, loading }) {
    const ranked = rows.map((r) => ({ ...r, pct: Math.round((r.otif / r.total) * 100) })).sort((a, b) => b.pct - a.pct || b.total - a.total);
    return (
        <section className="card">
            <h2 className="card-title">{title}</h2>
            {loading && <span className="skeleton sk-line" />}
            {!loading && ranked.length === 0 && <div className="empty">Sin datos con estos filtros.</div>}
            <ul className="rank">
                {ranked.map((r) => (
                    <li key={r.name}>
                        <span className="rank-name">{r.name}</span>
                        <span className="influence-bar"><span style={{ width: `${r.pct}%`, background: RANK_COLORS(r.pct) }} /></span>
                        <span className="rank-val"><strong>{r.pct}%</strong> <span className="hint">({r.total} OT)</span></span>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// OTIF = On Time In Full: share of finished orders delivered by the promised date and complete
function Otif() {
    const [stats, setStats] = useState(null);
    const [range, setRange] = useState({ from: '', to: '' });
    const [who, setWho] = useState({ customerId: '', driverId: '' });
    const [month, setMonth] = useState(''); // "2026-09" when a whole month is picked
    const [customers, setCustomers] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [groupBy, setGroupBy] = useState('month');
    const toast = useToast();

    // The lists for the customer and driver filters
    useEffect(() => {
        Promise.all([api.get('/customers'), api.get('/drivers')])
            .then(([c, d]) => {
                setCustomers(c.data);
                setDrivers(d.data);
            })
            .catch(() => toast('No se pudieron cargar los filtros', 'error'));
    }, [toast]);

    useEffect(() => {
        api.get('/otif', { params: { ...range, ...who, groupBy } })
            .then((res) => setStats(res.data))
            .catch(() => toast('No se pudo cargar el indicador', 'error'));
    }, [range, who, groupBy, toast]);

    const exportPdf = async () => {
        try {
            await downloadFile(api, '/otif/export/pdf', { ...range, ...who, groupBy }, `otif-${new Date().toLocaleDateString('en-CA')}.pdf`);
        } catch {
            toast('No se pudo exportar el indicador', 'error');
        }
    };

    // Picking a month fills the date range with its first and last day
    const pickMonth = (value) => {
        setMonth(value);
        if (!value) return setRange({ from: '', to: '' });
        const [year, monthNumber] = value.split('-').map(Number);
        setRange({ from: `${value}-01`, to: new Date(year, monthNumber, 0).toLocaleDateString('en-CA') });
    };
    const clearFilters = () => {
        setMonth('');
        setRange({ from: '', to: '' });
        setWho({ customerId: '', driverId: '' });
    };

    const loading = !stats;
    const total = stats?.total ?? 0;
    const pct = (n) => (total ? `${Math.round((n / total) * 100)}%` : '—');
    const tiles = [
        ['OTIF', pct(stats?.otif), 'A tiempo y completas'],
        ['A tiempo', pct(stats?.onTime), 'Entregadas hasta la fecha comprometida'],
        ['Completas', pct(stats?.inFull), 'Entregadas con toda la carga'],
        ['OT medidas', total, 'Entregadas o fallidas con fecha comprometida'],
    ];
    // Weekly bars: the last 12 weeks, or every week of the month picked
    const series = groupBy === 'week' && !month ? (stats?.series ?? []).slice(-WEEKS_SHOWN) : (stats?.series ?? []);
    const bars = series.map((s) => ({
        label: groupBy === 'week' ? weekLabel(s.period) : monthLabel(s.period),
        value: Math.round((s.otif / s.total) * 100),
        detail: `${s.otif} de ${s.total} OT cumplen OTIF`,
    }));

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <div className="page-head">
                        <div>
                            <h1 className="page-title">Indicador OTIF</h1>
                            <p className="page-sub">
                                On Time In Full: entregas a tiempo y completas. Una OT fallida cuenta como no cumplida.
                            </p>
                        </div>
                        <button className="btn" onClick={exportPdf}>⬇ Exportar PDF</button>
                    </div>
                </Reveal>

                <Reveal delay={100}>
                    <div className="filters">
                        <div className="field field-auto">
                            <label>Ver</label>
                            <div className="segmented">
                                <button type="button" className={groupBy === 'week' ? 'seg-on' : ''} onClick={() => setGroupBy('week')}>Semana</button>
                                <button type="button" className={groupBy === 'month' ? 'seg-on' : ''} onClick={() => setGroupBy('month')}>Mes</button>
                                <button type="button" className={groupBy === 'all' ? 'seg-on' : ''} onClick={() => setGroupBy('all')}>Todo el historial</button>
                            </div>
                        </div>
                        <div className="field">
                            <label>Un mes en particular</label>
                            <input className="input" type="month" value={month} onChange={(e) => pickMonth(e.target.value)} />
                        </div>
                        <div className="field">
                            <label>Cliente</label>
                            <select className="input" value={who.customerId} onChange={(e) => setWho({ ...who, customerId: e.target.value })}>
                                <option value="">Todos</option>
                                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="field">
                            <label>Conductor</label>
                            <select className="input" value={who.driverId} onChange={(e) => setWho({ ...who, driverId: e.target.value })}>
                                <option value="">Todos</option>
                                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-ghost" onClick={clearFilters}>Limpiar</button>
                    </div>
                </Reveal>

                <div className="overview">
                    <div className="stats stats-2">
                        {tiles.map(([label, value, hint], i) => (
                            <Reveal key={label} delay={150 + i * 90}>
                                <div className="stat">
                                    {loading ? <span className="skeleton sk-num" /> : <div className="stat-num">{value}</div>}
                                    <div className="stat-label">{label}</div>
                                    <div className="hint">{hint}</div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                    <Reveal delay={300}>
                        <DonutChart
                            title="Cumplimiento OTIF"
                            loading={loading}
                            totalLabel="OT medidas"
                            data={[
                                { label: 'OTIF', color: CHART.success, count: stats?.otif ?? 0 },
                                { label: 'No cumplen', color: CHART.danger, count: total - (stats?.otif ?? 0) },
                            ]}
                        />
                    </Reveal>
                </div>

                {groupBy !== 'all' && (
                    <Reveal delay={150}>
                        <BarChart
                            title={groupBy === 'week' ? (month ? 'OTIF por semana del mes' : 'OTIF de las últimas 12 semanas') : 'OTIF por mes'}
                            data={bars}
                            loading={loading}
                            emptyText="Aún no hay OT finalizadas con fecha comprometida. Crea una con fecha comprometida y llévala hasta «Entregada»."
                        />
                    </Reveal>
                )}

                <div className="overview overview-even">
                    <Reveal delay={200}><Ranking title="Por conductor" rows={stats?.byDriver ?? []} loading={loading} /></Reveal>
                    <Reveal delay={280}><Ranking title="Por cliente" rows={stats?.byCustomer ?? []} loading={loading} /></Reveal>
                </div>
            </main>
        </>
    );
}

export default Otif;
