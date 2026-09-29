const ExcelJS = require('exceljs');
const { sql, poolPromise } = require('../config/db');
const { RATE_JOIN, BILLABLE_DAYS } = require('../config/storage');
const { sendTablePdf } = require('../utils/pdf');
const { isPositiveInt, internalError } = require('../utils/validate');

const CONTAINER_TYPES = ['20DV', '40DV', '40HC', '20RF', '40RF'];
const STATUS_LABELS = { InYard: 'En patio', Departed: 'Retirado' };
const money = (n) => `$${Number(n).toLocaleString('es-CL')}`;

// Containers that have days to pay, with what they cost so far (final once they left).
// Optional filters: customerId, status (InYard = still accruing, Departed = closed).
const findCharges = async (req, res) => {
    const { customerId, status } = req.query;
    if (customerId && !isPositiveInt(Number(customerId))) return void res.status(400).json({ error: 'Cliente no válido' });
    if (status && !STATUS_LABELS[status]) return void res.status(400).json({ error: 'Estado no válido' });

    try {
        const pool = await poolPromise;
        const request = pool.request();
        let query = `SELECT c.id, c.container_number AS containerNumber, cu.id AS customerId, cu.name AS customerName,
                c.container_type AS containerType, c.status, c.arrived_at AS arrivedAt, c.departed_at AS departedAt,
                DATEDIFF(DAY, c.arrived_at, COALESCE(c.departed_at, GETDATE())) AS daysInYard,
                r.free_days AS freeDays, r.daily_rate AS dailyRate,
                ${BILLABLE_DAYS} AS billableDays, ${BILLABLE_DAYS} * r.daily_rate AS charge
            FROM container c JOIN customer cu ON cu.id = c.customer_id ${RATE_JOIN}
            WHERE ${BILLABLE_DAYS} > 0`;
        if (customerId) {
            request.input('customerId', sql.Int, Number(customerId));
            query += ' AND cu.id = @customerId';
        }
        if (status) {
            request.input('status', sql.VarChar(10), status);
            query += ' AND c.status = @status';
        }
        return (await request.query(`${query} ORDER BY cu.name, c.arrived_at`)).recordset;
    } catch (error) {
        internalError(res, error);
    }
};

// Charges per container, per customer and the total
exports.getBilling = async (req, res) => {
    const containers = await findCharges(req, res);
    if (!containers) return;

    const byCustomer = new Map();
    for (const c of containers) {
        const row = byCustomer.get(c.customerId) || { customerId: c.customerId, customerName: c.customerName, containers: 0, billableDays: 0, charge: 0 };
        row.containers += 1;
        row.billableDays += c.billableDays;
        row.charge += c.charge;
        byCustomer.set(c.customerId, row);
    }
    const accruing = containers.filter((c) => c.status === 'InYard').reduce((sum, c) => sum + c.charge, 0);
    const total = containers.reduce((sum, c) => sum + c.charge, 0);
    res.json({ containers, byCustomer: [...byCustomer.values()], total, accruing, closed: total - accruing });
};

exports.exportExcel = async (req, res) => {
    const rows = await findCharges(req, res);
    if (!rows) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Cobros');
    sheet.columns = [
        { header: 'Cliente', key: 'customerName', width: 28 },
        { header: 'Contenedor', key: 'containerNumber', width: 15 },
        { header: 'Tipo', key: 'containerType', width: 8 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Llegó', key: 'arrivedAt', width: 18, style: { numFmt: 'dd-mm-yyyy hh:mm' } },
        { header: 'Salió', key: 'departedAt', width: 18, style: { numFmt: 'dd-mm-yyyy hh:mm' } },
        { header: 'Días en patio', key: 'daysInYard', width: 14 },
        { header: 'Días libres', key: 'freeDays', width: 11 },
        { header: 'Días a cobrar', key: 'billableDays', width: 14 },
        { header: 'Tarifa diaria', key: 'dailyRate', width: 14, style: { numFmt: '"$"#,##0' } },
        { header: 'Cobro', key: 'charge', width: 14, style: { numFmt: '"$"#,##0' } },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow({ ...r, status: STATUS_LABELS[r.status] }));
    sheet.addRow({ customerName: 'TOTAL', charge: rows.reduce((sum, r) => sum + r.charge, 0) }).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cobros-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
};

exports.exportPdf = async (req, res) => {
    const rows = await findCharges(req, res);
    if (!rows) return;

    const total = rows.reduce((sum, r) => sum + r.charge, 0);
    sendTablePdf(res, {
        filename: `cobros-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: 'Cobros de almacenaje',
        subtitle: `Días en patio sobre los días libres de cada tipo de contenedor  ·  Total: ${money(total)}`,
        columns: [
            { header: 'Cliente', key: 'customerName', width: 4 },
            { header: 'Contenedor', key: 'containerNumber', width: 3 },
            { header: 'Tipo', key: 'containerType', width: 1.5 },
            { header: 'Estado', key: 'status', width: 2 },
            { header: 'En patio', key: 'daysInYard', width: 2, align: 'right' },
            { header: 'Libres', key: 'freeDays', width: 2, align: 'right' },
            { header: 'A cobrar', key: 'billableDays', width: 2, align: 'right' },
            { header: 'Tarifa/día', key: 'dailyRate', width: 2.5, align: 'right' },
            { header: 'Cobro', key: 'charge', width: 2.5, align: 'right' },
        ],
        rows: [
            ...rows.map((r) => ({ ...r, status: STATUS_LABELS[r.status], dailyRate: money(r.dailyRate), charge: money(r.charge) })),
            ...(rows.length ? [{ customerName: 'TOTAL', charge: money(total) }] : []),
        ],
    });
};

exports.getRates = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(
            'SELECT container_type AS containerType, free_days AS freeDays, daily_rate AS dailyRate FROM storage_rate ORDER BY container_type'
        );
        res.json(recordset);
    } catch (error) {
        internalError(res, error);
    }
};

// Charges are always computed with the current tariff, so a change applies to every container from now on
exports.updateRate = async (req, res) => {
    const { type } = req.params;
    const { freeDays, dailyRate } = req.body || {};
    if (!CONTAINER_TYPES.includes(type)) return res.status(404).json({ error: 'Tipo de contenedor no válido' });
    if (!Number.isInteger(freeDays) || freeDays < 0 || freeDays > 60) return res.status(400).json({ error: 'Los días libres van entre 0 y 60' });
    if (!Number.isInteger(dailyRate) || dailyRate < 0 || dailyRate > 1000000) return res.status(400).json({ error: 'La tarifa diaria va entre $0 y $1.000.000' });

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('type', sql.VarChar(4), type)
            .input('freeDays', sql.Int, freeDays)
            .input('dailyRate', sql.Int, dailyRate)
            .query('UPDATE storage_rate SET free_days = @freeDays, daily_rate = @dailyRate WHERE container_type = @type');
        res.json({ message: 'Tarifa actualizada' });
    } catch (error) {
        internalError(res, error);
    }
};
