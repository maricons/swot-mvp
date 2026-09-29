// src/pages/Otif.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import DonutChart from '../components/DonutChart';
import BarChart from '../components/BarChart';
import { useToast } from '../components/Toast';
import { formatDay, downloadFile } from '../utils/format';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// "2026-09-01" -> "sep 2026" for months, "28-09" for the Monday that starts a week
const periodLabel = (period, groupBy) => {
    const [year, month] = period.split('-');
    return groupBy === 'month' ? `${MONTHS[Number(month) - 1]} ${year}` : formatDay(period).slice(0, 5);
};

// OTIF = On Time In Full: share of finished orders delivered by the promised date and complete
function Otif() {
    const [stats, setStats] = useState(null);
    const [range, setRange] = useState({ from: '', to: '' });
    const [groupBy, setGroupBy] = useState('month');
    const toast = useToast();

    useEffect(() => {
        api.get('/otif', { params: { ...range, groupBy } })
            .then((res) => setStats(res.data))
            .catch(() => toast('No se pudo cargar el indicador', 'error'));
    }, [range, groupBy, toast]);

    const exportPdf = async () => {
        try {
            await downloadFile(api, '/otif/export/pdf', { ...range, groupBy }, `otif-${new Date().toLocaleDateString('en-CA')}.pdf`);
        } catch {
            toast('No se pudo exportar el indicador', 'error');
        }
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
    const bars = (stats?.series ?? []).map((s) => ({
        label: periodLabel(s.period, groupBy),
        value: Math.round((s.otif / s.total) * 100),
        detail: `${s.otif} de ${s.total} OT cumplen OTIF${groupBy === 'week' ? ` (semana del ${formatDay(s.period)})` : ''}`,
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
                        <div className="field">
                            <label>Agrupar por</label>
                            <div className="segmented">
                                <button type="button" className={groupBy === 'month' ? 'seg-on' : ''} onClick={() => setGroupBy('month')}>Mes</button>
                                <button type="button" className={groupBy === 'week' ? 'seg-on' : ''} onClick={() => setGroupBy('week')}>Semana</button>
                            </div>
                        </div>
                        <div className="field">
                            <label>Fecha comprometida desde</label>
                            <input className="input" type="date" value={range.from}
                                onChange={(e) => setRange({ ...range, from: e.target.value })} />
                        </div>
                        <div className="field">
                            <label>Hasta</label>
                            <input className="input" type="date" value={range.to}
                                onChange={(e) => setRange({ ...range, to: e.target.value })} />
                        </div>
                        <button className="btn btn-ghost" onClick={() => setRange({ from: '', to: '' })}>Limpiar</button>
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
                                { label: 'OTIF', color: '#9fd6b4', count: stats?.otif ?? 0 },
                                { label: 'No cumplen', color: '#ee9f9f', count: total - (stats?.otif ?? 0) },
                            ]}
                        />
                    </Reveal>
                </div>

                <Reveal delay={150}>
                    <BarChart
                        title={`OTIF por ${groupBy === 'month' ? 'mes' : 'semana'}`}
                        data={bars}
                        loading={loading}
                        emptyText="Aún no hay OT finalizadas con fecha comprometida. Crea una con fecha comprometida y llévala hasta «Entregada»."
                    />
                </Reveal>
            </main>
        </>
    );
}

export default Otif;
