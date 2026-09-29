// src/components/ContainerModal.jsx
import { useEffect, useState } from 'react';
import api from '../services/api';
import FormModal from './FormModal';
import { CARGO_LABELS, CONTAINER_TYPES, formatContainerInput } from '../utils/format';

const isReefer = (type) => type.endsWith('RF');

// Perishable cargo can only travel in a reefer: switch the type when the cargo changes
const normalize = (form) => (form.cargoType === 'perishable' && !isReefer(form.containerType) ? { ...form, containerType: '40RF' } : form);

// Announce a new container or edit one that has not left yet (row = the container to edit)
function ContainerModal({ row, onClose, onSaved }) {
    const [customers, setCustomers] = useState(null);

    useEffect(() => {
        api.get('/customers', { params: { active: 1 } }).then((res) => setCustomers(res.data)).catch(() => setCustomers([]));
    }, []);

    if (!customers) return null;

    const fields = [
        { name: 'containerNumber', label: 'Número de contenedor', placeholder: 'MSCU 123456-6', format: formatContainerInput, maxLength: 13,
            hint: 'Formato ISO 6346: 4 letras, 6 números y un dígito verificador (se valida).' },
        { name: 'customerId', type: 'select', label: 'Cliente dueño', options: [{ value: '', label: 'Selecciona un cliente' }, ...customers.map((c) => ({ value: String(c.id), label: c.name }))] },
        { name: 'cargoType', type: 'select', label: 'Tipo de carga', options: Object.entries(CARGO_LABELS).map(([value, label]) => ({ value, label })) },
        {
            name: 'containerType', type: 'select', label: 'Tipo de contenedor',
            options: (form) => CONTAINER_TYPES.filter(([code]) => form.cargoType === 'dry' || isReefer(code)).map(([value, label]) => ({ value, label: `${label} (${value})` })),
        },
        { name: 'temperatureC', label: 'Temperatura de operación (°C)', type: 'number', step: '0.5', min: '-30', max: '30', placeholder: 'Ej: 2',
            showIf: (form) => form.cargoType === 'perishable', hint: 'La carga perecedera va en un contenedor refrigerado a esta temperatura.' },
        { name: 'sealNumber', label: 'Precinto (opcional)', maxLength: 20, required: false },
        { name: 'expectedArrival', label: 'Llegada esperada (opcional)', type: 'date', required: false },
        { name: 'plannedDeparture', label: 'Salida prevista (opcional)', type: 'date', required: false },
        { name: 'notes', label: 'Notas (opcional)', maxLength: 255, required: false },
    ];

    const save = (form) => {
        const data = {
            containerNumber: form.containerNumber,
            customerId: Number(form.customerId),
            containerType: form.containerType,
            cargoType: form.cargoType,
            temperatureC: form.cargoType === 'perishable' && form.temperatureC !== '' ? Number(form.temperatureC) : undefined,
            sealNumber: form.sealNumber || undefined,
            expectedArrival: form.expectedArrival || undefined,
            plannedDeparture: form.plannedDeparture || undefined,
            notes: form.notes || undefined,
        };
        return row ? api.put(`/containers/${row.id}`, data) : api.post('/containers', data);
    };

    return (
        <FormModal
            title={row ? 'Editar contenedor' : 'Anunciar contenedor'}
            fields={fields}
            initial={{
                containerNumber: row ? formatContainerInput(row.containerNumber) : '',
                customerId: row ? String(row.customerId) : '',
                cargoType: row?.cargoType || 'dry',
                containerType: row?.containerType || '40HC',
                temperatureC: row?.temperatureC ?? '',
                sealNumber: row?.sealNumber || '',
                expectedArrival: row?.expectedArrival || '',
                plannedDeparture: row?.plannedDeparture || '',
                notes: row?.notes || '',
            }}
            normalize={normalize}
            submit={save}
            message={row ? 'Contenedor actualizado' : 'Contenedor anunciado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default ContainerModal;
