// src/components/ProgramarModal.jsx
import { useState } from 'react';
import api from '../services/api';

// Los IDs corresponden a los datos de prueba de database/init.sql
function ProgramarModal({ ot, onClose, onProgramada }) {
    const [vehiculoId, setVehiculoId] = useState('1');
    const [conductorId, setConductorId] = useState('2');
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setError('');
        setEnviando(true);
        try {
            await api.patch(`/ot/${ot.id}/programar`, {
                vehiculo_id: Number(vehiculoId),
                conductor_id: Number(conductorId),
            });
            onProgramada();
        } catch (err) {
            // 409: camión sin capacidad o revisión técnica vencida
            setError(err.response?.data?.error || 'No se pudo programar la OT');
            setEnviando(false);
        }
    };

    return (
        <div className="overlay" onClick={onClose}>
            <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={enviar}>
                <div className="modal-head">
                    <div>
                        <h3 className="modal-title">Programar OT #{ot.id}</h3>
                        <p className="page-sub">{ot.cliente_nombre} · {ot.peso_kg} kg</p>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <div className="field">
                        <label>ID del vehículo</label>
                        <input className="input" type="number" min="1" value={vehiculoId}
                            onChange={(e) => setVehiculoId(e.target.value)} required />
                        <span className="hint">1 = AB1234 (5.000 kg) · 2 = CD5678 (3.000 kg, revisión técnica vencida)</span>
                    </div>
                    <div className="field">
                        <label>ID del conductor</label>
                        <input className="input" type="number" min="1" value={conductorId}
                            onChange={(e) => setConductorId(e.target.value)} required />
                        <span className="hint">2 = Juan Conductor</span>
                    </div>
                    {error && <div className="error-box">{error}</div>}
                </div>

                <div className="modal-foot">
                    <button type="button" className="btn" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={enviando}>
                        {enviando ? 'Programando…' : 'Programar'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ProgramarModal;
