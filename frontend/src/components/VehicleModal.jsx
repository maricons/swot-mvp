// src/components/VehicleModal.jsx
import api from '../services/api';
import FormModal from './FormModal';

const fields = [
    { name: 'plate', label: 'Patente', placeholder: 'AB1234 o ABCD12', maxLength: 10 },
    { name: 'capacityKg', label: 'Capacidad (kg)', type: 'number', step: '0.01', min: '0.01' },
    {
        name: 'inspectionExpiry', label: 'Vencimiento de la revisión técnica', type: 'date',
        hint: 'Con la revisión vencida no se puede programar una OT.',
    },
];

function VehicleModal({ row, onClose, onSaved }) {
    const save = (form) => {
        const data = { ...form, capacityKg: Number(form.capacityKg) };
        return row ? api.put(`/vehicles/${row.id}`, data) : api.post('/vehicles', data);
    };

    return (
        <FormModal
            title={row ? 'Editar vehículo' : 'Nuevo vehículo'}
            fields={fields}
            initial={{
                plate: row?.plate || '',
                capacityKg: row?.capacityKg ?? '',
                inspectionExpiry: row?.inspectionExpiry || '',
            }}
            submit={save}
            message={row ? 'Vehículo actualizado' : 'Vehículo creado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default VehicleModal;
