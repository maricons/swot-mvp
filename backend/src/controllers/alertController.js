const { poolPromise } = require('../config/db');
const { internalError } = require('../utils/validate');

const INSPECTION_WARNING_DAYS = 30;

// Things that need attention: vehicles whose inspection expires soon (or already expired)
// and orders past their promised date that are still open
exports.getAlerts = async (req, res) => {
    try {
        const pool = await poolPromise;

        const vehicles = await pool.request().query(
            `SELECT id, plate, CONVERT(VARCHAR(10), inspection_expiry, 23) AS inspectionExpiry,
                    DATEDIFF(DAY, CAST(GETDATE() AS DATE), inspection_expiry) AS daysLeft
             FROM vehicle
             WHERE IsActive = 1 AND inspection_expiry <= DATEADD(DAY, ${INSPECTION_WARNING_DAYS}, CAST(GETDATE() AS DATE))
             ORDER BY inspection_expiry`
        );

        const orders = await pool.request().query(
            `SELECT o.id, c.name AS customerName, CONVERT(VARCHAR(10), o.due_date, 23) AS dueDate, o.status,
                    DATEDIFF(DAY, o.due_date, CAST(GETDATE() AS DATE)) AS daysLate
             FROM transport_order o JOIN customer c ON c.id = o.customer_id
             WHERE o.due_date < CAST(GETDATE() AS DATE) AND o.status NOT IN ('Delivered', 'Failed')
             ORDER BY o.due_date`
        );

        res.json({ vehicles: vehicles.recordset, overdueOrders: orders.recordset });
    } catch (error) {
        internalError(res, error);
    }
};
