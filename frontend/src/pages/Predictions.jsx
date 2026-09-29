// src/pages/Predictions.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import Topbar from '../components/Topbar';
import Reveal from '../components/Reveal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { formatDay } from '../utils/format';

// [key, label, min, max, step]
const INPUTS = [
    ['distanceKm', 'Distancia al cliente (km)', 0, 500, 1],
    ['weightKg', 'Peso (kg)', 1, 30000, 50],
    ['leadDays', 'Días entre crear la OT y la fecha comprometida', 0, 60, 1],
    ['itemCount', 'Productos distintos', 1, 200, 1],
    ['createdHour', 'Hora en que se crea (0-23)', 0, 23, 1],
];
const FEATURE_LABELS = {
    distanceKm: 'Distancia', weightKg: 'Peso', leadDays: 'Días de plazo', itemCount: 'Cantidad de productos',
    createdHour: 'Hora de creación', dueOnMonday: 'Entrega el lunes',
};
const LEVELS = { low: ['Riesgo bajo', 'badge-delivered'], medium: ['Riesgo medio', 'badge-in-transit'], high: ['Riesgo alto', 'badge-failed'] };
const DEFAULT_ORDER = { distanceKm: 40, weightKg: 1500, leadDays: 3, itemCount: 3, createdHour: 10, dueOnMonday: 0 };

const RiskBadge = ({ probability, level }) => (
    <span className={`badge ${LEVELS[level][1]}`}>{LEVELS[level][0]} · {Math.round(probability * 100)}%</span>
);

// Which orders are likely to arrive late, from a model trained on simulated data (see docs/ai-model.md)
function Predictions() {
    const [model, setModel] = useState(null);
    const [open, setOpen] = useState(null);
    const [order, setOrder] = useState(DEFAULT_ORDER);
    const [result, setResult] = useState(null);
    const toast = useToast();

    useEffect(() => {
        Promise.all([api.get('/predictions/model'), api.get('/predictions/open-orders')])
            .then(([m, o]) => {
                setModel(m.data);
                setOpen(o.data);
            })
            .catch(() => toast('No se pudieron cargar las predicciones', 'error'));
    }, [toast]);

    // The what-if answer follows the form as it changes
    useEffect(() => {
        const timer = setTimeout(() => {
            api.post('/predictions/late-risk', order).then((res) => setResult(res.data)).catch(() => setResult(null));
        }, 250);
        return () => clearTimeout(timer);
    }, [order]);

    const set = (key, value) => setOrder({ ...order, [key]: value === '' ? '' : Number(value) });
    const maxWeight = Math.max(...(model?.influence ?? []).map((i) => Math.abs(i.weight)), 1);

    return (
        <>
            <Topbar />
            <main className="container">
                <Reveal>
                    <div className="page-head">
                        <div>
                            <h1 className="page-title">Predicciones</h1>
                            <p className="page-sub">
                                Riesgo de que una OT llegue atrasada, calculado con un modelo entrenado con datos simulados
                                (aún no hay historial real suficiente).
                            </p>
                        </div>
                    </div>
                </Reveal>

                <div className="overview">
                    <Reveal delay={100}>
                        <section className="card">
                            <h2 className="card-title">El modelo</h2>
                            {!model ? <span className="skeleton sk-line" /> : (
                                <>
                                    <div className="stats stats-2">
                                        <div className="stat"><div className="stat-num">{Math.round(model.metrics.accuracy * 100)}%</div><div className="stat-label">Aciertos</div><div className="hint">En {model.testSize.toLocaleString('es-CL')} OT que no vio al entrenar</div></div>
                                        <div className="stat"><div className="stat-num">{model.metrics.auc.toLocaleString("es-CL", { maximumFractionDigits: 2 })}</div><div className="stat-label">AUC</div><div className="hint">1 = perfecto, 0,5 = azar</div></div>
                                    </div>
                                    <h3 className="card-title" style={{ marginTop: 16 }}>Qué pesa más en el atraso</h3>
                                    <ul className="influence">
                                        {[...model.influence].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).map((i) => (
                                            <li key={i.feature}>
                                                <span>{FEATURE_LABELS[i.feature]}</span>
                                                <span className="influence-bar"><span className={i.weight < 0 ? 'inf-down' : 'inf-up'} style={{ width: `${(Math.abs(i.weight) / maxWeight) * 100}%` }} /></span>
                                                <span className="hint">{i.weight < 0 ? 'baja el riesgo' : 'sube el riesgo'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </section>
                    </Reveal>

                    <Reveal delay={200}>
                        <section className="card">
                            <h2 className="card-title">Simulador: ¿y si…?</h2>
                            <div className="whatif">
                                {INPUTS.map(([key, label, min, max, step]) => (
                                    <div className="field" key={key}>
                                        <label>{label}</label>
                                        <input className="input" type="number" min={min} max={max} step={step} value={order[key]} onChange={(e) => set(key, e.target.value)} />
                                    </div>
                                ))}
                                <div className="field">
                                    <label>¿Se debe entregar un lunes?</label>
                                    <select className="input" value={order.dueOnMonday} onChange={(e) => set('dueOnMonday', e.target.value)}>
                                        <option value={0}>No</option>
                                        <option value={1}>Sí</option>
                                    </select>
                                </div>
                            </div>
                            <div className="whatif-result">{result ? <RiskBadge {...result} /> : <span className="hint">Completa todos los datos</span>}</div>
                        </section>
                    </Reveal>
                </div>

                <Reveal>
                    <section className="card">
                        <h2 className="card-title">OT abiertas, de mayor a menor riesgo</h2>
                        <div className="table-wrap">
                            <table className="table">
                                <thead><tr><th>OT</th><th>Cliente</th><th>Estado</th><th>Fecha comprometida</th><th>Distancia</th><th>Peso</th><th>Riesgo de atraso</th></tr></thead>
                                <tbody>
                                    {(open ?? []).map((o) => (
                                        <tr key={o.id}>
                                            <td>#{o.id}</td>
                                            <td>{o.customerName}</td>
                                            <td><StatusBadge status={o.status} /></td>
                                            <td>{formatDay(o.dueDate)}</td>
                                            <td className="num">{o.distanceKm} km</td>
                                            <td className="num">{o.weightKg.toLocaleString('es-CL')} kg</td>
                                            <td><RiskBadge probability={o.probability} level={o.level} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {open && open.length === 0 && <div className="empty">No hay OT abiertas con fecha comprometida.</div>}
                        </div>
                    </section>
                </Reveal>
            </main>
        </>
    );
}

export default Predictions;
