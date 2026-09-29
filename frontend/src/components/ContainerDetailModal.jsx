// src/components/ContainerDetailModal.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import ContainerStatusBadge from './ContainerStatusBadge';
import { CARGO_LABELS, CONTAINER_TYPES, EVENT_LABELS, formatContainerNumber, formatDay, formatDateTime } from '../utils/format';

const typeLabel = (code) => (CONTAINER_TYPES.find(([c]) => c === code) || [code, code])[1];

function ContainerDetailModal({ containerId, onClose }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`/containers/${containerId}`)
            .then((res) => setData(res.data))
            .catch(() => setError('No se pudo cargar el detalle'));
    }, [containerId]);

    const c = data?.container;

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h3 className="modal-title">{c ? formatContainerNumber(c.containerNumber) : 'Contenedor'}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                {error && <div className="error-box">{error}</div>}
                {!data && !error && <p className="page-sub">Cargando…</p>}

                {c && (
                    <>
                        <dl className="detail-grid">
                            <div className="detail-item"><dt>Estado</dt><dd><ContainerStatusBadge status={c.status} /></dd></div>
                            <div className="detail-item"><dt>Cliente</dt><dd>{c.customerName}</dd></div>
                            <div className="detail-item"><dt>Tipo</dt><dd>{typeLabel(c.containerType)} · {c.containerType}</dd></div>
                            <div className="detail-item">
                                <dt>Carga</dt>
                                <dd>{CARGO_LABELS[c.cargoType]}{c.cargoType === 'perishable' && ` · ${c.temperatureC} °C`}</dd>
                            </div>
                            <div className="detail-item"><dt>Ubicación</dt><dd>{c.yardLocation || '—'}</dd></div>
                            <div className="detail-item"><dt>Precinto</dt><dd>{c.sealNumber || '—'}</dd></div>
                            <div className="detail-item"><dt>Llegada esperada</dt><dd>{formatDay(c.expectedArrival)}</dd></div>
                            <div className="detail-item"><dt>Salida prevista</dt><dd>{formatDay(c.plannedDeparture)}</dd></div>
                            <div className="detail-item"><dt>Llegó</dt><dd>{c.arrivedAt ? formatDateTime(c.arrivedAt) : '—'}</dd></div>
                            <div className="detail-item"><dt>Salió</dt><dd>{c.departedAt ? formatDateTime(c.departedAt) : '—'}</dd></div>
                            {c.daysInYard != null && (
                                <div className="detail-item"><dt>Días en el patio</dt><dd>{c.daysInYard}</dd></div>
                            )}
                            {c.notes && <div className="detail-item"><dt>Notas</dt><dd>{c.notes}</dd></div>}
                        </dl>

                        <h4 className="card-title">Historial de movimientos</h4>
                        <ul className="timeline">
                            {data.events.map((e) => (
                                <li key={e.id}>
                                    <div className="tl-title">
                                        {EVENT_LABELS[e.eventType]}{e.yardLocation && ` · ${e.yardLocation}`}
                                    </div>
                                    <div className="tl-meta">
                                        {formatDateTime(e.eventAt)} · {e.userName || 'Sistema'}{e.notes && ` · ${e.notes}`}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}

export default ContainerDetailModal;
