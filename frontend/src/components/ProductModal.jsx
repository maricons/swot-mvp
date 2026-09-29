// src/components/ProductModal.jsx
import api from '../services/api';
import FormModal from './FormModal';

const CONTENT_UNITS = ['kg', 'g', 'mg', 'L', 'ml'];

const fields = [
    { name: 'photo', type: 'photo', label: 'Foto del producto' },
    { name: 'name', label: 'Nombre del producto', maxLength: 100, hint: 'Sin la cantidad: el contenido se ingresa abajo.' },
    { name: 'unit', label: 'Presentación', placeholder: 'unidad, caja, saco…', maxLength: 20 },
    {
        name: 'contentAmount', label: 'Contenido (opcional)', type: 'number', step: '0.001', min: '0.001',
        required: false, placeholder: 'Ej: 500',
        hint: 'Solo describe el producto (500 mg de activo, 20 L de pintura). No es su peso.',
    },
    { name: 'contentUnit', type: 'select', label: 'Unidad del contenido', options: CONTENT_UNITS.map((u) => ({ value: u, label: u })) },
    {
        name: 'weightKg', label: 'Peso por presentación (kg)', type: 'number', step: '0.001', min: '0.001',
        required: false, placeholder: 'Ej: 25',
        hint: 'Peso real de una unidad con su envase. Si lo dejas vacío, el peso de las OT con este producto se ingresa a mano.',
    },
];

function ProductModal({ row, onClose, onSaved }) {
    const save = (form) => {
        const hasAmount = form.contentAmount !== '';
        const data = {
            name: form.name,
            unit: form.unit,
            contentAmount: hasAmount ? Number(form.contentAmount) : null,
            contentUnit: hasAmount ? form.contentUnit : null,
            weightKg: form.weightKg !== '' ? Number(form.weightKg) : null,
            photo: form.photo,
        };
        return row ? api.put(`/products/${row.id}`, data) : api.post('/products', data);
    };

    return (
        <FormModal
            title={row ? 'Editar producto' : 'Nuevo producto'}
            fields={fields}
            initial={{
                photo: row?.photo ?? null,
                name: row?.name || '',
                unit: row?.unit || '',
                contentAmount: row?.contentAmount ?? '',
                contentUnit: row?.contentUnit || 'mg',
                weightKg: row?.weightKg ?? '',
            }}
            submit={save}
            message={row ? 'Producto actualizado' : 'Producto creado'}
            onClose={onClose}
            onSaved={onSaved}
        />
    );
}

export default ProductModal;
