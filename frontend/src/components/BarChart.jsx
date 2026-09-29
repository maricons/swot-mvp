// src/components/BarChart.jsx
import { useCallback, useRef, useState } from 'react';
import { CHART } from '../utils/format';

// Bar chart in plain SVG for percentages (0-100) over time.
// data = [{ label, value (0-100 or null), detail }]. Bars with a null value are drawn as an empty slot.
function BarChart({ title, data, loading, color = CHART.progress, emptyText = 'Sin datos para graficar.' }) {
    const [active, setActive] = useState(null);
    const observerRef = useRef(null);
    const [available, setAvailable] = useState(320);

    // The drawing is as wide as its card (text keeps its size on any screen); with many bars it scrolls instead of squeezing.
    // It is measured when the card appears and again whenever the card changes size.
    const measure = useCallback((el) => {
        observerRef.current?.disconnect();
        if (!el) return;
        setAvailable(Math.floor(el.clientWidth));
        observerRef.current = new ResizeObserver(([entry]) => setAvailable(Math.floor(entry.contentRect.width)));
        observerRef.current.observe(el);
    }, []);

    const width = Math.max(available, data.length * 56 + 48);
    const height = 220;
    const pad = { top: 16, right: 12, bottom: 44, left: 36 };
    const plotHeight = height - pad.top - pad.bottom;
    const slot = (width - pad.left - pad.right) / Math.max(data.length, 1);
    const barWidth = Math.min(44, slot * 0.6);

    return (
        <section className="card">
            <h2 className="card-title">{title}</h2>

            {loading && <span className="skeleton sk-chart" />}
            {!loading && data.length === 0 && <div className="empty">{emptyText}</div>}

            {!loading && data.length > 0 && (
                <div className="chart-scroll" ref={measure}>
                    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block' }} role="img" aria-label={title}>
                        {[0, 25, 50, 75, 100].map((tick) => {
                            const y = pad.top + plotHeight - (tick / 100) * plotHeight;
                            return (
                                <g key={tick}>
                                    <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e7e1d3" strokeDasharray={tick ? '3 4' : ''} />
                                    <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7a80">{tick}%</text>
                                </g>
                            );
                        })}

                        {data.map((d, i) => {
                            const x = pad.left + slot * i + (slot - barWidth) / 2;
                            const barHeight = d.value == null ? 0 : Math.max(2, (d.value / 100) * plotHeight);
                            return (
                                <g key={d.label} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                                    <rect x={pad.left + slot * i} y={pad.top} width={slot} height={plotHeight} fill="transparent" />
                                    <rect x={x} y={pad.top + plotHeight - barHeight} width={barWidth} height={barHeight} rx="6"
                                        fill={color} opacity={active === null || active === i ? 1 : 0.55} />
                                    {d.value != null && (
                                        <text x={x + barWidth / 2} y={pad.top + plotHeight - barHeight - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#1f2d33">
                                            {d.value}%
                                        </text>
                                    )}
                                    <text x={x + barWidth / 2} y={height - 24} textAnchor="middle" fontSize="10" fill="#6b7a80">{d.label}</text>
                                    <title>{`${d.label}: ${d.detail}`}</title>
                                </g>
                            );
                        })}
                    </svg>
                </div>
            )}
        </section>
    );
}

export default BarChart;
