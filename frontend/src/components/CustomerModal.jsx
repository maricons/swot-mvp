// src/components/CustomerModal.jsx
import api from '../services/api';
import FormModal from './FormModal';
import { formatTaxId } from '../utils/format';

const fields = [
    { name: 'name', label: 'Nombre de la empresa', maxLength: 100 },
    {
        name: 'taxId', label: 'RUT', placeholder: '76.123.456-0', maxLength: 12, format: formatTaxId,
        hint: 'Escribe solo números y K: los puntos y el guion se agregan solos.',
    },
    { name: 'address', label: 'Dirección', maxLength: 255 },
    { name: 'location', type: 'point', label: 'Punto de entrega en el mapa (opcional)' },
];

function CustomerModal({ row, onClose, onSaved }) {
    // The picked point travels as latitude and longitude (both empty when there is none)
    const save = ({ location, ...rest }) => {
        const data = { ...rest, latitude: location?.latitude ?? null, longitude: location?.longitude ?? null };
        return row ? api.put(`/customers/${row.id}`, data) : api.post('/customers', data);
    };

    return (
        <FormModal
            title={row ? 'Editar cliente' : 'Nuevo cliente'}
            fields={fields}
            initial={{
                name: row?.name || '', taxId: row?.taxId || '', address: row?.address || '',
                location: row?.latitude != null ? { latitude: row.latitude, longitude: row.longitude } : null,
            }}
            submit={save}
            message={row ? 'Cliente actualizado' : 'Cliente creado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default CustomerModal;
