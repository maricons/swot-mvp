const { sql, poolPromise } = require('../config/db');
const { internalError } = require('../utils/validate');

// The driver's phone reports where the truck is while an order is in transit.
// Only the last position is kept, and it is deleted when the driver has no order in transit.
exports.savePosition = async (req, res) => {
    const { latitude, longitude } = req.body || {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({ error: 'La posición no es válida' });
    }

    try {
        const pool = await poolPromise;
        const active = await pool.request().input('driver_id', sql.Int, req.user.id)
            .query("SELECT TOP 1 id FROM transport_order WHERE driver_id = @driver_id AND status = 'InTransit'");
        if (!active.recordset[0]) return res.status(409).json({ error: 'No tienes una OT en ruta: la ubicación no se comparte' });

        await pool.request()
            .input('driver_id', sql.Int, req.user.id)
            .input('latitude', sql.Decimal(9, 6), latitude)
            .input('longitude', sql.Decimal(9, 6), longitude)
            .execute('sp_save_truck_position');
        res.json({ message: 'Ubicación guardada' });
    } catch (error) {
        internalError(res, error);
    }
};

// One entry per order in transit: the truck with its last known position and the delivery point.
// position is null while the driver's phone has not reported yet; secondsAgo tells how fresh it is.
exports.getFleet = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(
            `SELECT o.id AS orderId, o.weight_kg AS weightKg, c.name AS customerName, c.address AS customerAddress,
                    c.latitude AS destinationLatitude, c.longitude AS destinationLongitude,
                    v.plate, u.id AS driverId, u.name AS driverName,
                    p.latitude AS latitude, p.longitude AS longitude,
                    DATEDIFF(SECOND, p.recorded_at, GETDATE()) AS secondsAgo
             FROM transport_order o
             JOIN customer c ON c.id = o.customer_id
             JOIN app_user u ON u.id = o.driver_id
             LEFT JOIN vehicle v ON v.id = o.vehicle_id
             LEFT JOIN truck_position p ON p.driver_id = o.driver_id
             WHERE o.status = 'InTransit'
             ORDER BY u.name, o.created_at`
        );

        res.json(recordset.map((r) => ({
            orderId: r.orderId,
            weightKg: r.weightKg,
            customerName: r.customerName,
            customerAddress: r.customerAddress,
            destination: r.destinationLatitude === null ? null : { latitude: r.destinationLatitude, longitude: r.destinationLongitude },
            plate: r.plate,
            driverId: r.driverId,
            driverName: r.driverName,
            position: r.latitude === null ? null : { latitude: r.latitude, longitude: r.longitude, secondsAgo: r.secondsAgo },
        })));
    } catch (error) {
        internalError(res, error);
    }
};
