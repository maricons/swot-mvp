// src/components/OrderDetailModal.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import StatusBadge from './StatusBadge';
import { STATUS_LABELS, formatDay, formatDateTime, productLabel } from '../utils/format';

function OrderDetailModal({ orderId, onClose }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`/orders/${orderId}`)
            .then((res) => setData(res.data))
            .catch(() => setError('No se pudo cargar el detalle'));
    }, [orderId]);

    const order = data?.order;

    return (
        <div className="overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-head">
                    <h3 className="modal-title">Orden #{orderId}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                {error && <div className="error-box">{error}</div>}
                {!data && !error && <p className="page-sub">Cargando…</p>}

                {order && (
                    <>
                        <dl className="detail-grid">
                            <div className="detail-item"><dt>Estado</dt><dd><StatusBadge status={order.status} driving /></dd></div>
                            <div className="detail-item"><dt>Peso</dt><dd>{Number(order.weightKg).toLocaleString('es-CL')} kg</dd></div>
                            <div className="detail-item"><dt>Cliente</dt><dd>{order.customerName}</dd></div>
                            <div className="detail-item"><dt>Dirección</dt><dd>{order.customerAddress}</dd></div>
                            <div className="detail-item"><dt>Vehículo</dt><dd>{order.plate || '—'}</dd></div>
                            <div className="detail-item"><dt>Conductor</dt><dd>{order.driverName || '—'}</dd></div>
                            <div className="detail-item"><dt>Fecha comprometida</dt><dd>{formatDay(order.dueDate)}</dd></div>
                            {order.deliveredAt && (
                                <div className="detail-item"><dt>Entrega</dt><dd>{order.inFull ? 'Completa' : 'Incompleta'}</dd></div>
                            )}
                            {order.receiverTaxId && (
                                <div className="detail-item"><dt>RUT de quien recibe</dt><dd>{order.receiverTaxId}</dd></div>
                            )}
                        </dl>

                        {order.deliveryPhoto && (
                            <>
                                <h4 className="card-title">Guía firmada</h4>
                                <a href={order.deliveryPhoto} target="_blank" rel="noreferrer">
                                    <img className="guide-photo" src={order.deliveryPhoto} alt="Foto de la guía firmada" />
                                </a>
                            </>
                        )}

                        {data.items.length > 0 && (
                            <>
                                <h4 className="card-title">Productos</h4>
                                <ul className="product-list">
                                    {data.items.map((it) => (
                                        <li key={it.id}>
                                            <span className="product-cell">
                                                {it.photo ? <img className="thumb" src={it.photo} alt="" /> : <span className="thumb thumb-empty">📦</span>}
                                                <span>{productLabel(it)}</span>
                                            </span>
                                            <strong>× {it.quantity} {it.unit}</strong>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}

                        <h4 className="card-title">Historial de cambios</h4>
                        <ul className="timeline">
                            {data.history.map((h) => (
                                <li key={h.id}>
                                    <div className="tl-title">{STATUS_LABELS[h.newStatus]}</div>
                                    <div className="tl-meta">{formatDateTime(h.changedAt)} · {h.userName || 'Sistema'}</div>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}

export default OrderDetailModal;
