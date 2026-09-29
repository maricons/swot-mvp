const ExcelJS = require('exceljs');
const { sql, poolPromise } = require('../config/db');
const { isPositiveInt, isDate, isImage, normalizeTaxId, internalError } = require('../utils/validate');
const { sendTablePdf, formatDay } = require('../utils/pdf');

const STATUSES = ['Created', 'Scheduled', 'InTransit', 'Delivered', 'Failed'];
// Screens, Excel and PDF show the status in Spanish
const STATUS_LABELS = {
    Created: 'Creada', Scheduled: 'Programada', InTransit: 'En ruta', Delivered: 'Entregada', Failed: 'Fallida',
};

// Status changes a driver can make: current status -> allowed next statuses
const TRANSITIONS = {
    Scheduled: ['InTransit'],
    InTransit: ['Delivered', 'Failed'],
};

const MAX_DELIVERY_PHOTO_LENGTH = 400000; // the browser shrinks the picture first (~200 KB of image)

// Columns shared by the lists. The delivery photo is heavy, so lists only say whether there is one
const ORDER_COLUMNS = `o.id, o.customer_id AS customerId, c.name AS customerName, o.vehicle_id AS vehicleId,
    o.driver_id AS driverId, o.status, o.weight_kg AS weightKg, o.created_at AS createdAt,
    CONVERT(VARCHAR(10), o.due_date, 23) AS dueDate, o.delivered_at AS deliveredAt, o.in_full AS inFull,
    o.receiver_tax_id AS receiverTaxId, CASE WHEN o.delivery_photo IS NULL THEN 0 ELSE 1 END AS hasDeliveryPhoto`;

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) : '');

// Validates the filters and returns the matching orders; on failure it answers the request and returns null
const findOrders = async (req, res) => {
    const { status, from, to } = req.query;

    if (status && !STATUSES.includes(status)) {
        res.status(400).json({ error: 'Estado no válido' });
        return null;
    }
    if ((from && !isDate(from)) || (to && !isDate(to))) {
        res.status(400).json({ error: 'Fecha no válida (usa AAAA-MM-DD)' });
        return null;
    }

    try {
        const pool = await poolPromise;
        const request = pool.request();
        // Only fixed text is concatenated; the user's values always travel as parameters
        let query = `SELECT ${ORDER_COLUMNS}
                     FROM transport_order o
                     JOIN customer c ON c.id = o.customer_id
                     WHERE 1 = 1`;

        if (status) {
            request.input('status', sql.VarChar(20), status);
            query += ' AND o.status = @status';
        }
        if (from) {
            request.input('from', sql.Date, from);
            query += ' AND o.created_at >= @from';
        }
        if (to) {
            // Includes the whole "to" day
            request.input('to', sql.Date, to);
            query += ' AND o.created_at < DATEADD(DAY, 1, @to)';
        }
        const result = await request.query(`${query} ORDER BY o.created_at DESC`);
        return result.recordset;
    } catch (error) {
        internalError(res, error);
        return null;
    }
};

exports.list = async (req, res) => {
    const rows = await findOrders(req, res);
    if (rows) res.json(rows);
};

const fileDate = () => new Date().toISOString().slice(0, 10);

// Downloads the same list (with the same filters) as an Excel file
exports.exportExcel = async (req, res) => {
    const rows = await findOrders(req, res);
    if (!rows) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Órdenes');
    sheet.columns = [
        { header: 'OT', key: 'id', width: 8 },
        { header: 'Cliente', key: 'customerName', width: 28 },
        { header: 'Peso (kg)', key: 'weightKg', width: 12 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Creada', key: 'createdAt', width: 14, style: { numFmt: 'dd-mm-yyyy' } },
        { header: 'Fecha comprometida', key: 'dueDate', width: 20, style: { numFmt: 'dd-mm-yyyy' } },
        { header: 'Entregada el', key: 'deliveredAt', width: 18, style: { numFmt: 'dd-mm-yyyy hh:mm' } },
        { header: 'Entrega completa', key: 'inFull', width: 16 },
        { header: 'RUT de quien recibe', key: 'receiverTaxId', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow({
        ...r,
        status: STATUS_LABELS[r.status],
        dueDate: r.dueDate ? new Date(`${r.dueDate}T00:00:00`) : null,
        inFull: r.inFull === null ? '' : r.inFull ? 'Sí' : 'No',
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ordenes-${fileDate()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
};

// Same list as a PDF
exports.exportPdf = async (req, res) => {
    const rows = await findOrders(req, res);
    if (!rows) return;

    const { status, from, to } = req.query;
    const filters = [status && `Estado: ${STATUS_LABELS[status]}`, from && `Desde: ${formatDay(from)}`, to && `Hasta: ${formatDay(to)}`]
        .filter(Boolean).join('  ·  ');

    sendTablePdf(res, {
        filename: `ordenes-${fileDate()}.pdf`,
        title: 'Órdenes de transporte',
        subtitle: `${rows.length} órdenes · Generado el ${formatDate(new Date())}${filters ? `  ·  ${filters}` : ''}`,
        columns: [
            { header: 'OT', key: 'id', width: 1 },
            { header: 'Cliente', key: 'customerName', width: 4 },
            { header: 'Peso (kg)', key: 'weightKg', width: 2, align: 'right' },
            { header: 'Estado', key: 'status', width: 2 },
            { header: 'Creada', key: 'createdAt', width: 2 },
            { header: 'Compromiso', key: 'dueDate', width: 2 },
            { header: 'Entrega', key: 'inFull', width: 2 },
        ],
        rows: rows.map((r) => ({
            id: `#${r.id}`,
            customerName: r.customerName,
            weightKg: Number(r.weightKg).toLocaleString('es-CL'),
            status: STATUS_LABELS[r.status],
            createdAt: formatDate(r.createdAt),
            dueDate: formatDay(r.dueDate) || '—',
            inFull: r.inFull === null ? '—' : r.inFull ? 'Completa' : 'Incompleta',
        })),
    });
};

exports.create = async (req, res) => {
    const { customerId, dueDate, items = [] } = req.body || {};
    let { weightKg } = req.body || {};

    if (!isPositiveInt(customerId)) {
        return res.status(400).json({ error: 'customerId debe ser un número entero positivo' });
    }
    if (dueDate && (!isDate(dueDate) || dueDate < new Date().toLocaleDateString('en-CA'))) {
        return res.status(400).json({ error: 'La fecha comprometida no es válida o ya pasó' });
    }
    if (!Array.isArray(items) || items.length > 50
        || items.some((i) => !isPositiveInt(i?.productId) || !isPositiveInt(i?.quantity))) {
        return res.status(400).json({ error: 'Cada producto necesita un id y una cantidad entera positiva (máx. 50)' });
    }

    try {
        const pool = await poolPromise;
        const customer = await pool.request().input('id', sql.Int, customerId)
            .query('SELECT id, IsActive FROM customer WHERE id = @id');
        if (!customer.recordset[0]) {
            return res.status(404).json({ error: 'El cliente no existe' });
        }
        if (!customer.recordset[0].IsActive) {
            return res.status(409).json({ error: 'El cliente está desactivado' });
        }

        const itemsJson = items.length
            ? JSON.stringify(items.map(({ productId, quantity }) => ({ product_id: productId, quantity })))
            : null;

        if (itemsJson) {
            // Every product must exist and be active
            const found = await pool.request().input('items', sql.NVarChar(sql.MAX), itemsJson).query(
                `SELECT DISTINCT p.id, p.weight_kg
                 FROM product p JOIN OPENJSON(@items) WITH (product_id INT '$.product_id') j ON j.product_id = p.id
                 WHERE p.IsActive = 1`
            );
            const weights = new Map(found.recordset.map((p) => [p.id, p.weight_kg]));
            if (weights.size !== new Set(items.map((i) => i.productId)).size) {
                return res.status(409).json({ error: 'Algún producto no existe o está desactivado' });
            }
            // When every product has a weight, the total is calculated here and never typed by hand
            if ([...weights.values()].every((w) => w !== null)) {
                const total = items.reduce((sum, i) => sum + i.quantity * weights.get(i.productId), 0);
                weightKg = Math.max(0.01, Math.round(total * 100) / 100);
            }
        }
        if (typeof weightKg !== 'number' || !(weightKg > 0) || weightKg > 100000) {
            return res.status(400).json({ error: 'Ingresa el peso total (entre 0 y 100.000 kg): algún producto no tiene peso definido' });
        }

        const result = await pool.request()
            .input('customer_id', sql.Int, customerId)
            .input('weight_kg', sql.Decimal(10, 2), weightKg)
            .input('user_id', sql.Int, req.user.id)
            .input('due_date', sql.Date, dueDate || null)
            .input('items', sql.NVarChar(sql.MAX), itemsJson)
            .execute('sp_create_order');

        res.status(201).json({ message: 'OT creada exitosamente', id: result.recordset[0].order_id });
    } catch (error) {
        internalError(res, error);
    }
};

exports.schedule = async (req, res) => {
    const id = Number(req.params.id);
    const { vehicleId, driverId } = req.body || {};

    if (!isPositiveInt(id) || !isPositiveInt(vehicleId) || !isPositiveInt(driverId)) {
        return res.status(400).json({ error: 'Los ids deben ser números enteros positivos' });
    }

    try {
        const pool = await poolPromise;

        const order = await pool.request().input('id', sql.Int, id)
            .query('SELECT weight_kg, status FROM transport_order WHERE id = @id');
        const vehicle = await pool.request().input('id', sql.Int, vehicleId)
            .query('SELECT capacity_kg, inspection_expiry, IsActive FROM vehicle WHERE id = @id');
        const driver = await pool.request().input('id', sql.Int, driverId)
            .query("SELECT id FROM app_user WHERE id = @id AND role = 'driver' AND IsActive = 1");

        if (!order.recordset[0] || !vehicle.recordset[0] || !driver.recordset[0]) {
            return res.status(404).json({ error: 'OT, vehículo o conductor no encontrado' });
        }
        if (order.recordset[0].status !== 'Created') {
            return res.status(409).json({ error: 'Solo se pueden programar OT en estado Creada' });
        }

        // Business rules
        if (!vehicle.recordset[0].IsActive) {
            return res.status(409).json({ error: 'El vehículo está desactivado' });
        }
        if (order.recordset[0].weight_kg > vehicle.recordset[0].capacity_kg) {
            return res.status(409).json({ error: 'Camión sin capacidad' });
        }
        if (new Date(vehicle.recordset[0].inspection_expiry) < new Date()) {
            return res.status(409).json({ error: 'Revisión técnica vencida' });
        }

        await pool.request()
            .input('order_id', sql.Int, id)
            .input('vehicle_id', sql.Int, vehicleId)
            .input('driver_id', sql.Int, driverId)
            .input('user_id', sql.Int, req.user.id)
            .execute('sp_schedule_order');

        res.json({ message: 'OT programada exitosamente' });
    } catch (error) {
        internalError(res, error);
    }
};

exports.changeStatus = async (req, res) => {
    const id = Number(req.params.id);
    // inFull, receiverTaxId and deliveryPhoto only matter when delivering
    const { status, inFull, receiverTaxId, deliveryPhoto } = req.body || {};

    if (!isPositiveInt(id)) {
        return res.status(400).json({ error: 'Id no válido' });
    }
    if (!['InTransit', 'Delivered', 'Failed'].includes(status)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }
    if (inFull !== undefined && typeof inFull !== 'boolean') {
        return res.status(400).json({ error: 'inFull debe ser true o false' });
    }

    // A delivery needs its proof: the RUT of whoever received and a photo of the signed guide
    let proofTaxId = null;
    if (status === 'Delivered') {
        proofTaxId = normalizeTaxId(receiverTaxId);
        if (!proofTaxId) {
            return res.status(400).json({ error: 'Ingresa un RUT válido de quien recibe (ej: 12.345.678-5)' });
        }
        if (!isImage(deliveryPhoto, MAX_DELIVERY_PHOTO_LENGTH)) {
            return res.status(400).json({ error: 'Adjunta la foto de la guía firmada (imagen JPG, PNG o WEBP)' });
        }
    }

    try {
        const pool = await poolPromise;
        const order = await pool.request().input('id', sql.Int, id)
            .query('SELECT status, driver_id FROM transport_order WHERE id = @id');
        const current = order.recordset[0];

        // A driver can only touch their own orders (404 so we do not reveal it exists)
        if (!current || current.driver_id !== req.user.id) {
            return res.status(404).json({ error: 'OT no encontrada' });
        }
        if (!(TRANSITIONS[current.status] || []).includes(status)) {
            return res.status(409).json({ error: `No se puede pasar de ${STATUS_LABELS[current.status]} a ${STATUS_LABELS[status]}` });
        }

        await pool.request()
            .input('order_id', sql.Int, id)
            .input('new_status', sql.VarChar(20), status)
            .input('user_id', sql.Int, req.user.id)
            .input('in_full', sql.Bit, inFull ?? null)
            .input('receiver_tax_id', sql.VarChar(20), proofTaxId)
            .input('delivery_photo', sql.VarChar(sql.MAX), status === 'Delivered' ? deliveryPhoto : null)
            .execute('sp_change_order_status');
        res.json({ message: `Estado actualizado a ${STATUS_LABELS[status]}` });
    } catch (error) {
        internalError(res, error);
    }
};

exports.getDetail = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) {
        return res.status(400).json({ error: 'Id no válido' });
    }

    try {
        const pool = await poolPromise;
        const orderResult = await pool.request().input('id', sql.Int, id).query(`
            SELECT ${ORDER_COLUMNS}, c.address AS customerAddress, v.plate, u.name AS driverName, o.delivery_photo AS deliveryPhoto
            FROM transport_order o
            JOIN customer c ON c.id = o.customer_id
            LEFT JOIN vehicle v ON v.id = o.vehicle_id
            LEFT JOIN app_user u ON u.id = o.driver_id
            WHERE o.id = @id`);

        const order = orderResult.recordset[0];
        // A driver can only see their own orders
        if (!order || (req.user.role === 'driver' && order.driverId !== req.user.id)) {
            return res.status(404).json({ error: 'OT no encontrada' });
        }

        const history = await pool.request().input('order_id', sql.Int, id).query(`
            SELECT h.id, h.previous_status AS previousStatus, h.new_status AS newStatus,
                   h.changed_at AS changedAt, u.name AS userName
            FROM order_history h
            LEFT JOIN app_user u ON u.id = h.user_id
            WHERE h.order_id = @order_id
            ORDER BY h.changed_at ASC, h.id ASC`);

        const items = await pool.request().input('order_id', sql.Int, id).query(`
            SELECT i.id, p.name, p.unit, p.content_amount AS contentAmount, p.content_unit AS contentUnit,
                   p.photo, i.quantity
            FROM order_item i JOIN product p ON p.id = i.product_id
            WHERE i.order_id = @order_id ORDER BY i.id`);

        res.json({ order, history: history.recordset, items: items.recordset });
    } catch (error) {
        internalError(res, error);
    }
};

// The orders assigned to the logged-in driver that are still pending
exports.myRoute = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('driver_id', sql.Int, req.user.id)
            .query(`SELECT ${ORDER_COLUMNS}, c.address AS customerAddress, v.plate
                    FROM transport_order o
                    JOIN customer c ON c.id = o.customer_id
                    LEFT JOIN vehicle v ON v.id = o.vehicle_id
                    WHERE o.driver_id = @driver_id AND o.status IN ('Scheduled', 'InTransit')
                    ORDER BY o.created_at`);
        res.json(result.recordset);
    } catch (error) {
        internalError(res, error);
    }
};
