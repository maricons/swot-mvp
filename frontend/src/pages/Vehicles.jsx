// src/pages/Vehicles.jsx
import CatalogPage from '../components/CatalogPage';
import VehicleModal from '../components/VehicleModal';
import DonutChart from '../components/DonutChart';
import AlertsPanel from '../components/AlertsPanel';
import Reveal from '../components/Reveal';
import { formatDay } from '../utils/format';

const columns = [
    { header: 'Patente', cell: (v) => <strong>{v.plate}</strong> },
    { header: 'Capacidad', cell: (v) => `${Number(v.capacityKg).toLocaleString('es-CL')} kg`, className: 'num' },
    {
        header: 'Revisión técnica',
        cell: (v) => (
            <>
                {formatDay(v.inspectionExpiry)}{' '}
                <span className={`badge ${v.inspectionValid ? 'badge-delivered' : 'badge-failed'}`}>
                    {v.inspectionValid ? 'Vigente' : 'Vencida'}
                </span>
            </>
        ),
    },
    { header: 'OT', cell: (v) => v.totalOrders, className: 'num' },
];

// Alerts + KPI tiles + donut with valid vs expired inspections (of the vehicles in view)
const overview = (vehicles, loading) => {
    const valid = vehicles.filter((v) => v.inspectionValid).length;
    const tiles = [['Vehículos en vista', vehicles.length], ['RT vigentes', valid], ['RT vencidas', vehicles.length - valid]];
    return (
        <>
            <AlertsPanel onlyVehicles />
            <div className="overview">
                <div className="stats">
                    {tiles.map(([label, value], i) => (
                        <Reveal key={label} delay={100 + i * 90}>
                            <div className="stat">
                                {loading ? <span className="skeleton sk-num" /> : <div className="stat-num">{value}</div>}
                                <div className="stat-label">{label}</div>
                            </div>
                        </Reveal>
                    ))}
                </div>
                <Reveal delay={250}>
                    <DonutChart
                        title="Revisiones técnicas"
                        loading={loading}
                        totalLabel="vehículos"
                        data={[
                            { label: 'Vigentes', color: '#9fd6b4', count: valid },
                            { label: 'Vencidas', color: '#ee9f9f', count: vehicles.length - valid },
                        ]}
                    />
                </Reveal>
            </div>
        </>
    );
};

function Vehicles() {
    return (
        <CatalogPage
            title="Vehículos"
            subtitle="Flota de camiones, su capacidad y la vigencia de la revisión técnica."
            path="/vehicles"
            searchPlaceholder="Patente"
            newLabel="Nuevo vehículo"
            columns={columns}
            Modal={VehicleModal}
            label={(v) => v.plate}
            above={overview}
        />
    );
}

export default Vehicles;
