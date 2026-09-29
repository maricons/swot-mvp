const { poolPromise } = require('../config/db');
const { RATE_JOIN, BILLABLE_DAYS } = require('../config/storage');
const { internalError } = require('../utils/validate');

const INSPECTION_WARNING_DAYS = 30;

// Each role only gets the alerts of the services it works with:
// transport (inspections, overdue orders) for the dispatcher, container storage for the yard operator, both for the rest
const WANTS = {
    dispatcher: { transport: true, storage: false },
    yard: { transport: false, storage: true },
    supervisor: { transport: true, storage: true },
    admin: { transport: true, storage: true },
};

// Things that need attention: vehicles whose inspection expires soon (or already expired), orders past their
// promised date that are still open, containers that overstay in the yard and containers past their planned departure
exports.getAlerts = async (req, res) => {
    const wants = WANTS[req.user.role];
    try {
        const pool = await poolPromise;
        const run = async (enabled, query) => (enabled ? (await pool.request().query(query)).recordset : []);

        const [vehicles, overdueOrders, overstayContainers, overdueContainers] = await Promise.all([
            run(wants.transport,
                `SELECT id, plate, CONVERT(VARCHAR(10), inspection_expiry, 23) AS inspectionExpiry,
                        DATEDIFF(DAY, CAST(GETDATE() AS DATE), inspection_expiry) AS daysLeft
                 FROM vehicle
                 WHERE IsActive = 1 AND inspection_expiry <= DATEADD(DAY, ${INSPECTION_WARNING_DAYS}, CAST(GETDATE() AS DATE))
                 ORDER BY inspection_expiry`),
            run(wants.transport,
                `SELECT o.id, c.name AS customerName, CONVERT(VARCHAR(10), o.due_date, 23) AS dueDate, o.status,
                        DATEDIFF(DAY, o.due_date, CAST(GETDATE() AS DATE)) AS daysLate
                 FROM transport_order o JOIN customer c ON c.id = o.customer_id
                 WHERE o.due_date < CAST(GETDATE() AS DATE) AND o.status NOT IN ('Delivered', 'Failed')
                 ORDER BY o.due_date`),
            run(wants.storage,
                `SELECT c.id, c.container_number AS containerNumber, cu.name AS customerName, c.yard_location AS yardLocation,
                        DATEDIFF(DAY, c.arrived_at, GETDATE()) AS daysInYard, r.free_days AS freeDays,
                        ${BILLABLE_DAYS} * r.daily_rate AS charge
                 FROM container c JOIN customer cu ON cu.id = c.customer_id ${RATE_JOIN}
                 WHERE c.status = 'InYard' AND ${BILLABLE_DAYS} > 0
                 ORDER BY c.arrived_at`),
            run(wants.storage,
                `SELECT c.id, c.container_number AS containerNumber, cu.name AS customerName, c.status,
                        CONVERT(VARCHAR(10), c.planned_departure, 23) AS plannedDeparture,
                        DATEDIFF(DAY, c.planned_departure, CAST(GETDATE() AS DATE)) AS daysLate
                 FROM container c JOIN customer cu ON cu.id = c.customer_id
                 WHERE c.status IN ('Expected', 'InYard') AND c.planned_departure < CAST(GETDATE() AS DATE)
                 ORDER BY c.planned_departure`),
        ]);

        res.json({ vehicles, overdueOrders, overstayContainers, overdueContainers });
    } catch (error) {
        internalError(res, error);
    }
};
