// Container storage rules shared by the container controller, the alerts and the billing.
// The free days and the daily rate live in the storage_rate table (one row per container type).
const DAYS_IN_YARD = 'DATEDIFF(DAY, c.arrived_at, COALESCE(c.departed_at, GETDATE()))';

module.exports = {
    // Add it after "FROM container c" to have r.free_days and r.daily_rate
    RATE_JOIN: 'JOIN storage_rate r ON r.container_type = c.container_type',
    // Days past the free days (0 while inside them). A container that has not arrived yet has none
    BILLABLE_DAYS: `CASE WHEN c.arrived_at IS NULL OR ${DAYS_IN_YARD} <= r.free_days THEN 0 ELSE ${DAYS_IN_YARD} - r.free_days END`,
};
