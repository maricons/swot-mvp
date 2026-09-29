// src/components/ContainerEventModal.jsx
import api from '../services/api';
import FormModal from './FormModal';
import { formatContainerNumber } from '../utils/format';

// What each event asks for and how it is sent. arrive and move need a yard position; depart only takes a note.
const EVENTS = {
    arrive: {
        title: 'Registrar llegada', submitText: 'Registrar llegada', message: 'Llegada registrada',
        fields: [
            { name: 'yardLocation', label: 'Ubicación en el patio', placeholder: 'A-03-2', maxLength: 20, hint: 'Letras, números y guiones. Ej: A-03-2 (bloque-fila-nivel).' },
            { name: 'sealNumber', label: 'Precinto (opcional)', maxLength: 20, required: false, hint: 'Solo si cambió o no estaba registrado.' },
            { name: 'notes', label: 'Notas (opcional)', maxLength: 255, required: false },
        ],
    },
    move: {
        title: 'Mover de posición', submitText: 'Registrar movimiento', message: 'Movimiento registrado',
        fields: [
            { name: 'yardLocation', label: 'Nueva ubicación', placeholder: 'B-01-1', maxLength: 20 },
            { name: 'notes', label: 'Notas (opcional)', maxLength: 255, required: false },
        ],
    },
    depart: {
        title: 'Registrar salida', submitText: 'Registrar salida', message: 'Salida registrada',
        fields: [{ name: 'notes', label: 'Notas (opcional)', maxLength: 255, required: false, placeholder: 'Ej: retirado por el camión de la empresa' }],
    },
};

// kind = "arrive" | "move" | "depart"
function ContainerEventModal({ container, kind, onClose, onSaved }) {
    const event = EVENTS[kind];
    const initial = Object.fromEntries(event.fields.map((f) => [f.name, '']));

    return (
        <FormModal
            title={`${event.title} · ${formatContainerNumber(container.containerNumber)}`}
            fields={event.fields}
            initial={initial}
            submitText={event.submitText}
            message={event.message}
            submit={(form) => api.post(`/containers/${container.id}/${kind}`, form)}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default ContainerEventModal;
