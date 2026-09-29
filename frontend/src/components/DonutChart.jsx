// src/components/DonutChart.jsx
import { useState } from 'react';

// Generic donut chart in plain SVG. data = [{ label, count, color }]
function DonutChart({ title, data, loading, totalLabel = 'en total' }) {
    const [active, setActive] = useState(null);

    const total = data.reduce((sum, d) => sum + d.count, 0);

    // Circumference is 100, so a percentage maps directly to a dash length
    const segments = data
        .filter((d) => d.count > 0)
        .map((d, i, list) => ({
            ...d,
            percent: (d.count / total) * 100,
            start: (list.slice(0, i).reduce((sum, x) => sum + x.count, 0) / total) * 100,
        }));

    const selected = data.find((d) => d.label === active);

    return (
        <section className="card donut-card">
            <h2 className="card-title">{title}</h2>

            {loading ? (
                <span className="skeleton sk-donut" />
            ) : (
                <div className="donut-body">
                    <div className="donut-wrap">
                        <svg viewBox="0 0 42 42" className="donut" role="img" aria-label={title}>
                            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#efe9db" strokeWidth="6" />
                            {segments.map((s) => {
                                const dash = Math.max(s.percent - 0.6, 0.1);
                                return (
                                    <circle
                                        key={s.label}
                                        className="donut-seg"
                                        cx="21" cy="21" r="15.9155" fill="none"
                                        stroke={s.color}
                                        strokeWidth={active === s.label ? 7 : 6}
                                        strokeDasharray={`${dash} ${100 - dash}`}
                                        strokeDashoffset={25 - s.start}
                                        onMouseEnter={() => setActive(s.label)}
                                        onMouseLeave={() => setActive(null)}
                                    >
                                        <title>{`${s.label}: ${s.count}`}</title>
                                    </circle>
                                );
                            })}
                        </svg>
                        <div className="donut-centro">
                            <div className="donut-num">{selected ? selected.count : total}</div>
                            <div className="donut-etq">{selected ? selected.label : totalLabel}</div>
                        </div>
                    </div>

                    <ul className="donut-leyenda">
                        {data.map((d) => (
                            <li
                                key={d.label}
                                className={active === d.label ? 'leyenda-activa' : ''}
                                onMouseEnter={() => setActive(d.label)}
                                onMouseLeave={() => setActive(null)}
                            >
                                <span className="leyenda-punto" style={{ background: d.color }} />
                                <span className="leyenda-nombre">{d.label}</span>
                                <span className="leyenda-valor">
                                    {d.count}
                                    {total > 0 && <small> · {Math.round((d.count / total) * 100)}%</small>}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

export default DonutChart;
