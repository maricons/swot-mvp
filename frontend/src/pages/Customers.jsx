// src/pages/Customers.jsx
import CatalogPage from '../components/CatalogPage';
import CustomerModal from '../components/CustomerModal';

const columns = [
    { header: 'Empresa', cell: (c) => <strong>{c.name}</strong> },
    { header: 'RUT', cell: (c) => c.taxId, className: 'num' },
    { header: 'Dirección', cell: (c) => c.address },
    { header: 'Mapa', cell: (c) => (c.latitude != null ? '📍 Sí' : <span className="hint">Sin ubicación</span>) },
    { header: 'OT', cell: (c) => c.totalOrders, className: 'num' },
];

function Customers() {
    return (
        <CatalogPage
            title="Clientes"
            subtitle="Empresas a las que Neo Tech presta servicio de transporte."
            path="/customers"
            searchPlaceholder="Nombre o RUT"
            newLabel="Nuevo cliente"
            columns={columns}
            Modal={CustomerModal}
            label={(c) => c.name}
        />
    );
}

export default Customers;
