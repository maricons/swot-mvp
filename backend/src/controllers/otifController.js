const { sql, poolPromise } = require('../config/db');
const { isDate, isPositiveInt, internalError } = require('../utils/validate');
const { sendTablePdf, formatDay } = require('../utils/pdf');

// OTIF = On Time In Full. Universe: orders with a promised date that finished (delivered or failed).
// An order counts as OTIF when it was delivered on or before the promised date and the delivery was complete.
// A failed order never counts.
const ON_TIME = "status = 'Delivered' AND CAST(delivered_at AS DATE) <= due_date";
const IN_FULL = "status = 'Delivered' AND in_full = 1";

// First day of the month each order belongs to
const MONTH = 'DATEFROMPARTS(YEAR(due_date), MONTH(due_date), 1)';
// month = one row per month; all = the whole history as a single total
const GROUPINGS = ['month', 'all'];

const COUNTS = `COUNT(*) AS total,
    COALESCE(SUM(CASE WHEN ${ON_TIME} THEN 1 ELSE 0 END), 0) AS onTime,
    COALESCE(SUM(CASE WHEN ${IN_FULL} THEN 1 ELSE 0 END), 0) AS inFull,
    COALESCE(SUM(CASE WHEN ${ON_TIME} AND in_full = 1 THEN 1 ELSE 0 END), 0) AS otif`;

// Validates the query and returns { summary, series, groupBy, from, to }; on failure it answers and returns null
const computeOtif = async (req, res) => {
    const { from, to } = req.query;
    const groupBy = req.query.groupBy || 'month';
    // Optional filters by customer and by driver (ids arrive as text in the query string)
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    const driverId = req.query.driverId ? Number(req.query.driverId) : null;
    if ((from && !isDate(from)) || (to && !isDate(to)) || !GROUPINGS.includes(groupBy)
        || (customerId !== null && !isPositiveInt(customerId)) || (driverId !== null && !isPositiveInt(driverId))) {
        res.status(400).json({ error: 'Parámetros no válidos (fechas AAAA-MM-DD, groupBy month o all, ids numéricos)' });
        return null;
    }

    try {
        const pool = await poolPromise;
        const request = pool.request();
        let where = "status IN ('Delivered', 'Failed') AND due_date IS NOT NULL";
        if (from) {
            request.input('from', sql.Date, from);
            where += ' AND due_date >= @from';
        }
        if (to) {
            request.input('to', sql.Date, to);
            where += ' AND due_date <= @to';
        }
        if (customerId) {
            request.input('customerId', sql.Int, customerId);
            where += ' AND customer_id = @customerId';
        }
        if (driverId) {
            request.input('driverId', sql.Int, driverId);
            where += ' AND driver_id = @driverId';
        }

        const summary = await request.query(`SELECT ${COUNTS} FROM transport_order WHERE ${where}`);
        // The monthly series is only needed when grouping by month
        const series = groupBy === 'month' ? await request.query(
            `SELECT CONVERT(VARCHAR(10), ${MONTH}, 23) AS period, ${COUNTS}
             FROM transport_order WHERE ${where}
             GROUP BY ${MONTH} ORDER BY ${MONTH}`
        ) : { recordset: [] };
        // The names of the filters, for the title of the PDF
        const names = await pool.request().input('customerId', sql.Int, customerId).input('driverId', sql.Int, driverId).query(
            `SELECT (SELECT name FROM customer WHERE id = @customerId) AS customerName, (SELECT name FROM app_user WHERE id = @driverId) AS driverName`
        );
        return { summary: summary.recordset[0], series: series.recordset, groupBy, from, to, ...names.recordset[0] };
    } catch (error) {
        internalError(res, error);
        return null;
    }
};

exports.getOtif = async (req, res) => {
    const result = await computeOtif(req, res);
    if (result) res.json({ ...result.summary, series: result.series });
};

const percent = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : '—');

exports.exportPdf = async (req, res) => {
    const result = await computeOtif(req, res);
    if (!result) return;
    const { summary, series, groupBy, from, to, customerName, driverName } = result;

    const row = (label, r) => ({
        period: label, total: r.total, onTime: percent(r.onTime, r.total), inFull: percent(r.inFull, r.total), otif: percent(r.otif, r.total),
    });
    const filters = [from && `Desde: ${formatDay(from)}`, to && `Hasta: ${formatDay(to)}`, customerName && `Cliente: ${customerName}`, driverName && `Conductor: ${driverName}`]
        .filter(Boolean).join('  ·  ');

    sendTablePdf(res, {
        filename: `otif-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: 'Indicador OTIF',
        subtitle: `On Time In Full ${groupBy === 'month' ? 'por mes' : 'de todo el historial'} (según fecha comprometida)${filters ? `  ·  ${filters}` : ''}`,
        columns: [
            { header: groupBy === 'month' ? 'Mes' : 'Período', key: 'period', width: 3 },
            { header: 'OT medidas', key: 'total', width: 2, align: 'right' },
            { header: 'A tiempo', key: 'onTime', width: 2, align: 'right' },
            { header: 'Completas', key: 'inFull', width: 2, align: 'right' },
            { header: 'OTIF', key: 'otif', width: 2, align: 'right' },
        ],
        rows: groupBy === 'month'
            ? [...series.map((s) => row(formatDay(s.period), s)), row('TOTAL', summary)]
            : [row('Todo el historial', summary)],
    });
};
