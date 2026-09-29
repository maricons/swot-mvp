// src/components/DeliveryModal.jsx
import { useState } from 'react';
import api from '../services/api';
import PhotoInput from './PhotoInput';
import { formatTaxId } from '../utils/format';

// Proof of delivery: RUT of whoever received, photo of the signed guide and whether it was complete
function DeliveryModal({ order, onClose, onDelivered }) {
    const [taxId, setTaxId] = useState('');
    const [photo, setPhoto] = useState(null);
    const [inFull, setInFull] = useState(true);
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    const send = async (e) => {
        e.preventDefault();
        if (!photo) {
            setError('Adjunta la foto de la guía firmada.');
            return;
        }
        setError('');
        setSending(true);
        try {
            await api.patch(`/orders/${order.id}/status`, {
                status: 'Delivered', inFull, receiverTaxId: taxId, deliveryPhoto: photo,
            });
            onDelivered();
        } catch (err) {
            setError(err.response?.data?.error || 'No se pudo registrar la entrega');
            setSending(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
                <div className="modal-head">
                    <div>
                        <h3 className="modal-title">Registrar entrega · OT #{order.id}</h3>
                        <p className="page-sub">{order.customerName}</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="field">
                        <label>RUT de quien recibe</label>
                        <input className="input" value={taxId} onChange={(e) => setTaxId(formatTaxId(e.target.value))}
                            placeholder="12.345.678-5" maxLength={12} required />
                    </div>

                    <div className="field">
                        <label>Foto de la guía firmada</label>
                        <PhotoInput value={photo} onChange={setPhoto} max={1000} quality={0.7}
                            emptyText="Sin foto" pickText="Tomar o subir foto" capture="environment" />
                    </div>

                    <div className="field">
                        <label>¿La entrega está completa?</label>
                        <div className="segmented">
                            <button type="button" className={inFull ? 'seg-on' : ''} onClick={() => setInFull(true)}>Completa</button>
                            <button type="button" className={!inFull ? 'seg-on' : ''} onClick={() => setInFull(false)}>Incompleta</button>
                        </div>
                    </div>

                    {error && <div className="error-box">{error}</div>}
                </div>

                <div className="modal-foot">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-success" disabled={sending}>
                        {sending ? 'Guardando…' : 'Confirmar entrega'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default DeliveryModal;
