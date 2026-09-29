// src/components/EstadoBadge.jsx
const clases = {
    'Creada': 'badge-creada',
    'Programada': 'badge-programada',
    'En ruta': 'badge-en-ruta',
    'Entregada': 'badge-entregada',
    'Fallida': 'badge-fallida',
};

function EstadoBadge({ estado }) {
    return <span className={`badge ${clases[estado] || 'badge-creada'}`}>{estado}</span>;
}

export default EstadoBadge;
