// src/components/DriverModal.jsx
import api from '../services/api';
import FormModal from './FormModal';

function DriverModal({ row, onClose, onSaved }) {
    const fields = [
        { name: 'name', label: 'Nombre completo', maxLength: 100 },
        { name: 'email', label: 'Correo', type: 'email', maxLength: 100 },
        {
            name: 'password',
            label: row ? 'Nueva contraseña (opcional)' : 'Contraseña',
            type: 'password',
            autoComplete: 'new-password',
            required: !row,
            minLength: 8,
            hint: row ? 'Déjala en blanco para no cambiarla.' : 'Mínimo 8 caracteres.',
        },
    ];

    return (
        <FormModal
            title={row ? 'Editar conductor' : 'Nuevo conductor'}
            fields={fields}
            initial={{ name: row?.name || '', email: row?.email || '', password: '' }}
            submit={(form) => (row ? api.put(`/drivers/${row.id}`, form) : api.post('/drivers', form))}
            message={row ? 'Conductor actualizado' : 'Conductor creado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default DriverModal;
