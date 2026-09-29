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
];

function CustomerModal({ row, onClose, onSaved }) {
    return (
        <FormModal
            title={row ? 'Editar cliente' : 'Nuevo cliente'}
            fields={fields}
            initial={{ name: row?.name || '', taxId: row?.taxId || '', address: row?.address || '' }}
            submit={(form) => (row ? api.put(`/customers/${row.id}`, form) : api.post('/customers', form))}
            message={row ? 'Cliente actualizado' : 'Cliente creado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default CustomerModal;
