// src/pages/Drivers.jsx
import CatalogPage from '../components/CatalogPage';
import DriverModal from '../components/DriverModal';

const columns = [
    { header: 'Conductor', cell: (d) => <strong>{d.name}</strong> },
    { header: 'Correo', cell: (d) => d.email },
    { header: 'OT', cell: (d) => d.totalOrders, className: 'num' },
];

function Drivers() {
    return (
        <CatalogPage
            title="Conductores"
            subtitle="Personas que ejecutan las entregas. Un conductor desactivado no puede iniciar sesión."
            path="/drivers"
            searchPlaceholder="Nombre o correo"
            newLabel="Nuevo conductor"
            columns={columns}
            Modal={DriverModal}
            label={(d) => d.name}
        />
    );
}

export default Drivers;
