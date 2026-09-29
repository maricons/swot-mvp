// src/components/DriverMap.jsx
import { useMemo } from 'react';
import MapView from './MapView';
import { STATUS_LABELS } from '../utils/format';

// The stops of the driver's route on a map: numbered in delivery order, the one in transit highlighted,
// and the driver's own position when the phone shares it. Orders whose customer has no point on the map are counted apart.
function DriverMap({ orders, position }) {
    const stops = useMemo(() => orders.filter((o) => o.customerLatitude != null), [orders]);

    const markers = useMemo(() => [
        ...stops.map((o, i) => ({
            id: `stop-${o.id}`,
            latitude: o.customerLatitude,
            longitude: o.customerLongitude,
            label: i + 1,
            tone: o.status === 'InTransit' ? 'active' : 'stop',
            title: `${i + 1}. ${o.customerName}`,
            lines: [o.customerAddress, `OT #${o.id} · ${Number(o.weightKg).toLocaleString('es-CL')} kg · ${STATUS_LABELS[o.status]}`],
        })),
        ...(position ? [{ id: 'me', latitude: position.latitude, longitude: position.longitude, label: '🚚', tone: 'me', title: 'Tú estás aquí' }] : []),
    ], [stops, position]);

    // A dashed line from the truck (if known) through the stops in order
    const paths = useMemo(() => {
        const points = stops.map((o) => [o.customerLatitude, o.customerLongitude]);
        if (position) points.unshift([position.latitude, position.longitude]);
        return points.length > 1 ? [points] : [];
    }, [stops, position]);

    const missing = orders.length - stops.length;

    return (
        <section className="card driver-map">
            <MapView markers={markers} paths={paths} height={280} />
            <p className="hint map-note">
                {stops.length === 0
                    ? 'Ninguno de tus clientes tiene ubicación en el mapa todavía. Pídele al administrador que la agregue en Clientes.'
                    : `${stops.length} ${stops.length === 1 ? 'parada' : 'paradas'} en el mapa${missing > 0 ? ` · ${missing} sin ubicación` : ''}`}
            </p>
        </section>
    );
}

export default DriverMap;
