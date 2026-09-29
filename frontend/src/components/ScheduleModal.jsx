// src/components/ScheduleModal.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatDay } from '../utils/format';

// Assigns a vehicle and a driver to an order. The API rejects a truck without capacity or with an expired inspection.
function ScheduleModal({ order, onClose, onScheduled }) {
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [vehicleId, setVehicleId] = useState('');
    const [driverId, setDriverId] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get('/vehicles', { params: { active: 1 } }),
            api.get('/drivers', { params: { active: 1 } }),
        ])
            .then(([v, d]) => {
                setVehicles(v.data);
                setDrivers(d.data);
            })
            .catch(() => setError('No se pudieron cargar los vehículos y conductores'));
    }, []);

    const send = async (e) => {
        e.preventDefault();
        setError('');
        setSending(true);
        try {
            await api.patch(`/orders/${order.id}/schedule`, { vehicleId: Number(vehicleId), driverId: Number(driverId) });
            onScheduled();
        } catch (err) {
            // 409: truck without capacity or expired inspection
            setError(err.response?.data?.error || 'No se pudo programar la OT');
            setSending(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={send}>
                <div className="modal-head">
                    <div>
                        <h3 className="modal-title">Programar OT #{order.id}</h3>
                        <p className="page-sub">{order.customerName} · {Number(order.weightKg).toLocaleString('es-CL')} kg</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="field">
                        <label>Vehículo</label>
                        <select className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
                            <option value="">Selecciona un vehículo</option>
                            {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {v.plate} · {Number(v.capacityKg).toLocaleString('es-CL')} kg · RT {v.inspectionValid ? 'vigente' : `vencida (${formatDay(v.inspectionExpiry)})`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="field">
                        <label>Conductor</label>
                        <select className="input" value={driverId} onChange={(e) => setDriverId(e.target.value)} required>
                            <option value="">Selecciona un conductor</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    {error && <div className="error-box">{error}</div>}
                </div>

                <div className="modal-foot">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={sending}>
                        {sending ? 'Programando…' : 'Programar'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ScheduleModal;
