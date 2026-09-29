// src/components/DetalleModal.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import EstadoBadge from './EstadoBadge';

const formatoFecha = (f) =>
    new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

function DetalleModal({ otId, onClose }) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`/ot/${otId}`)
            .then((res) => setDatos(res.data))
            .catch(() => setError('No se pudo cargar el detalle'));
    }, [otId]);

    const d = datos?.detalle;

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h3 className="modal-title">Orden #{otId}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                {error && <div className="error-box">{error}</div>}
                {!datos && !error && <p className="page-sub">Cargando…</p>}

                {d && (
                    <>
                        <dl className="detail-grid">
                            <div className="detail-item"><dt>Estado</dt><dd><EstadoBadge estado={d.estado} /></dd></div>
                            <div className="detail-item"><dt>Peso</dt><dd>{d.peso_kg} kg</dd></div>
                            <div className="detail-item"><dt>Cliente</dt><dd>{d.cliente_nombre}</dd></div>
                            <div className="detail-item"><dt>Dirección</dt><dd>{d.cliente_direccion}</dd></div>
                            <div className="detail-item"><dt>Vehículo</dt><dd>{d.patente || '—'}</dd></div>
                            <div className="detail-item"><dt>Conductor</dt><dd>{d.conductor_nombre || '—'}</dd></div>
                        </dl>

                        <h4 className="card-title">Historial de cambios</h4>
                        <ul className="timeline">
                            {datos.historial.map((h) => (
                                <li key={h.id}>
                                    <div className="tl-title">{h.estado_nuevo}</div>
                                    <div className="tl-meta">
                                        {formatoFecha(h.fecha_cambio)} · {h.usuario_nombre || 'Sistema'}
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

export default DetalleModal;
