const { sql, poolPromise } = require('../config/db');
const { RATE_JOIN, BILLABLE_DAYS } = require('../config/storage');
const { normalizeContainerNumber, isDate, isPositiveInt, internalError } = require('../utils/validate');

const CONTAINER_TYPES = ['20DV', '40DV', '40HC', '20RF', '40RF'];
const CARGO_TYPES = ['dry', 'perishable'];
const STATUSES = ['Expected', 'InYard', 'Departed'];
const STATUS_LABELS = { Expected: 'Esperado', InYard: 'En patio', Departed: 'Retirado' };

// Same columns for the list and the detail. daysInYard counts up to now while the container is still inside;
// the charge is what it costs so far (final once it departed)
const CONTAINER_COLUMNS = `c.id, c.container_number AS containerNumber, c.customer_id AS customerId, cu.name AS customerName,
    c.container_type AS containerType, c.cargo_type AS cargoType, c.temperature_c AS temperatureC,
    c.seal_number AS sealNumber, c.status, c.yard_location AS yardLocation,
    CONVERT(VARCHAR(10), c.expected_arrival, 23) AS expectedArrival, c.arrived_at AS arrivedAt,
    CONVERT(VARCHAR(10), c.planned_departure, 23) AS plannedDeparture, c.departed_at AS departedAt, c.notes,
    CASE WHEN c.arrived_at IS NULL THEN NULL ELSE DATEDIFF(DAY, c.arrived_at, COALESCE(c.departed_at, GETDATE())) END AS daysInYard,
    r.free_days AS freeDays, r.daily_rate AS dailyRate, ${BILLABLE_DAYS} AS billableDays, ${BILLABLE_DAYS} * r.daily_rate AS charge,
    CASE WHEN c.status = 'InYard' AND ${BILLABLE_DAYS} > 0 THEN 1 ELSE 0 END AS overstay,
    CASE WHEN c.status IN ('Expected', 'InYard') AND c.planned_departure < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS departureOverdue`;

const FROM = `FROM container c JOIN customer cu ON cu.id = c.customer_id ${RATE_JOIN}`;

// Yard positions like A-03-2: letters, digits and hyphens
const cleanLocation = (text) => (typeof text === 'string' && /^[A-Za-z0-9-]{1,20}$/.test(text.trim()) ? text.trim().toUpperCase() : null);
const cleanText = (text, max) => (typeof text === 'string' && text.trim() && text.trim().length <= max ? text.trim() : null);

// Validates the body of create/update. Returns { data } or { error }.
const validate = (body) => {
    const { containerNumber, customerId, containerType, cargoType, temperatureC, sealNumber, expectedArrival, plannedDeparture, notes } = body || {};

    const number = normalizeContainerNumber(containerNumber);
    if (!number) return { error: 'El número de contenedor no es válido (formato ISO 6346, ej: MSCU 123456-6)' };
    if (!isPositiveInt(customerId)) return { error: 'Selecciona el cliente dueño del contenedor' };
    if (!CONTAINER_TYPES.includes(containerType)) return { error: `El tipo debe ser uno de: ${CONTAINER_TYPES.join(', ')}` };
    if (!CARGO_TYPES.includes(cargoType)) return { error: 'La carga debe ser seca o perecedera' };

    // Perishable cargo needs a refrigerated container and its set temperature
    let temperature = null;
    if (cargoType === 'perishable') {
        if (!containerType.endsWith('RF')) return { error: 'La carga perecedera va en un contenedor refrigerado (20RF o 40RF)' };
        if (typeof temperatureC !== 'number' || temperatureC < -30 || temperatureC > 30) {
            return { error: 'Indica la temperatura de operación (entre -30 y 30 °C)' };
        }
        temperature = temperatureC;
    }

    if (expectedArrival && !isDate(expectedArrival)) return { error: 'La fecha de llegada esperada no es válida' };
    if (plannedDeparture && !isDate(plannedDeparture)) return { error: 'La fecha de salida prevista no es válida' };
    if (expectedArrival && plannedDeparture && plannedDeparture < expectedArrival) {
        return { error: 'La salida prevista no puede ser antes de la llegada esperada' };
    }
    if (sealNumber && !cleanText(sealNumber, 20)) return { error: 'El precinto puede tener hasta 20 caracteres' };
    if (notes && !cleanText(notes, 255)) return { error: 'Las notas pueden tener hasta 255 caracteres' };

    return {
        data: {
            number, customerId, containerType, cargoType, temperature,
            sealNumber: sealNumber ? cleanText(sealNumber, 20) : null,
            expectedArrival: expectedArrival || null,
            plannedDeparture: plannedDeparture || null,
            notes: notes ? cleanText(notes, 255) : null,
        },
    };
};

// Every container needs an active customer
const customerIsActive = async (pool, id) => {
    const r = await pool.request().input('id', sql.Int, id).query('SELECT IsActive FROM customer WHERE id = @id');
    return r.recordset[0]?.IsActive === true;
};

const numberTaken = async (pool, number, excludeId = 0) => {
    const r = await pool.request()
        .input('number', sql.VarChar(11), number)
        .input('id', sql.Int, excludeId)
        .query('SELECT id FROM container WHERE container_number = @number AND id <> @id');
    return r.recordset.length > 0;
};

exports.list = async (req, res) => {
    const { status, cargoType, search } = req.query;
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Estado no válido' });
    if (cargoType && !CARGO_TYPES.includes(cargoType)) return res.status(400).json({ error: 'Tipo de carga no válido' });

    try {
        const pool = await poolPromise;
        const request = pool.request();
        let query = `SELECT ${CONTAINER_COLUMNS} ${FROM} WHERE 1 = 1`;
        if (status) {
            request.input('status', sql.VarChar(10), status);
            query += ' AND c.status = @status';
        }
        if (cargoType) {
            request.input('cargoType', sql.VarChar(10), cargoType);
            query += ' AND c.cargo_type = @cargoType';
        }
        if (typeof search === 'string' && search.trim()) {
            request.input('search', sql.VarChar(50), `%${search.trim()}%`);
            query += ' AND (c.container_number LIKE @search OR cu.name LIKE @search OR c.yard_location LIKE @search OR c.seal_number LIKE @search)';
        }
        // In the yard first, then the ones on their way, then the ones already gone
        const result = await request.query(
            `${query} ORDER BY CASE c.status WHEN 'InYard' THEN 0 WHEN 'Expected' THEN 1 ELSE 2 END, c.arrived_at DESC, c.expected_arrival`
        );
        res.json(result.recordset);
    } catch (error) {
        internalError(res, error);
    }
};

// Numbers for the yard dashboard
exports.summary = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(
            `SELECT
                COALESCE(SUM(CASE WHEN c.status = 'Expected' THEN 1 END), 0) AS expected,
                COALESCE(SUM(CASE WHEN c.status = 'InYard' THEN 1 END), 0) AS inYard,
                COALESCE(SUM(CASE WHEN c.status = 'Departed' THEN 1 END), 0) AS departed,
                COALESCE(SUM(CASE WHEN c.status = 'InYard' AND c.cargo_type = 'perishable' THEN 1 END), 0) AS perishableInYard,
                COALESCE(SUM(CASE WHEN c.status = 'InYard' AND c.cargo_type = 'dry' THEN 1 END), 0) AS dryInYard,
                COALESCE(SUM(CASE WHEN c.status = 'InYard' AND ${BILLABLE_DAYS} > 0 THEN 1 END), 0) AS overstays,
                COALESCE(AVG(CASE WHEN c.status = 'InYard' THEN DATEDIFF(DAY, c.arrived_at, GETDATE()) END), 0) AS avgDaysInYard
             FROM container c ${RATE_JOIN}`
        );
        res.json(recordset[0]);
    } catch (error) {
        internalError(res, error);
    }
};

exports.getDetail = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });

    try {
        const pool = await poolPromise;
        const container = await pool.request().input('id', sql.Int, id)
            .query(`SELECT ${CONTAINER_COLUMNS} ${FROM} WHERE c.id = @id`);
        if (!container.recordset[0]) return res.status(404).json({ error: 'Contenedor no encontrado' });

        const events = await pool.request().input('id', sql.Int, id).query(
            `SELECT e.id, e.event_type AS eventType, e.event_at AS eventAt, e.yard_location AS yardLocation, e.notes, u.name AS userName
             FROM container_event e LEFT JOIN app_user u ON u.id = e.user_id
             WHERE e.container_id = @id ORDER BY e.event_at ASC, e.id ASC`
        );
        res.json({ container: container.recordset[0], events: events.recordset });
    } catch (error) {
        internalError(res, error);
    }
};

exports.create = async (req, res) => {
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        if (!(await customerIsActive(pool, data.customerId))) return res.status(409).json({ error: 'El cliente no existe o está desactivado' });
        if (await numberTaken(pool, data.number)) return res.status(409).json({ error: 'Ya existe un contenedor con ese número' });

        const result = await pool.request()
            .input('container_number', sql.VarChar(11), data.number)
            .input('customer_id', sql.Int, data.customerId)
            .input('container_type', sql.VarChar(4), data.containerType)
            .input('cargo_type', sql.VarChar(10), data.cargoType)
            .input('temperature_c', sql.Decimal(4, 1), data.temperature)
            .input('seal_number', sql.VarChar(20), data.sealNumber)
            .input('expected_arrival', sql.Date, data.expectedArrival)
            .input('planned_departure', sql.Date, data.plannedDeparture)
            .input('notes', sql.VarChar(255), data.notes)
            .input('user_id', sql.Int, req.user.id)
            .execute('sp_create_container');
        res.status(201).json({ message: 'Contenedor registrado', id: result.recordset[0].container_id });
    } catch (err) {
        internalError(res, err);
    }
};

// Edit the data of a container that has not left yet (status and dates of arrival/departure only change through events)
exports.update = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        const current = await pool.request().input('id', sql.Int, id).query('SELECT status FROM container WHERE id = @id');
        if (!current.recordset[0]) return res.status(404).json({ error: 'Contenedor no encontrado' });
        if (current.recordset[0].status === 'Departed') return res.status(409).json({ error: 'Un contenedor retirado ya no se puede editar' });
        if (!(await customerIsActive(pool, data.customerId))) return res.status(409).json({ error: 'El cliente no existe o está desactivado' });
        if (await numberTaken(pool, data.number, id)) return res.status(409).json({ error: 'Ya existe otro contenedor con ese número' });

        await pool.request()
            .input('id', sql.Int, id)
            .input('container_number', sql.VarChar(11), data.number)
            .input('customer_id', sql.Int, data.customerId)
            .input('container_type', sql.VarChar(4), data.containerType)
            .input('cargo_type', sql.VarChar(10), data.cargoType)
            .input('temperature_c', sql.Decimal(4, 1), data.temperature)
            .input('seal_number', sql.VarChar(20), data.sealNumber)
            .input('expected_arrival', sql.Date, data.expectedArrival)
            .input('planned_departure', sql.Date, data.plannedDeparture)
            .input('notes', sql.VarChar(255), data.notes)
            .query(`UPDATE container SET container_number = @container_number, customer_id = @customer_id, container_type = @container_type,
                    cargo_type = @cargo_type, temperature_c = @temperature_c, seal_number = @seal_number,
                    expected_arrival = @expected_arrival, planned_departure = @planned_departure, notes = @notes WHERE id = @id`);
        res.json({ message: 'Contenedor actualizado' });
    } catch (err) {
        internalError(res, err);
    }
};

// Arrival, move and departure share the same steps: check the id, check the current status, run the procedure
const registerEvent = ({ eventType, from, needsLocation, message }) => async (req, res) => {
    const id = Number(req.params.id);
    const { yardLocation, sealNumber, notes } = req.body || {};
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });

    const location = needsLocation ? cleanLocation(yardLocation) : null;
    if (needsLocation && !location) return res.status(400).json({ error: 'Indica la ubicación en el patio (ej: A-03-2)' });
    if (sealNumber && !cleanText(sealNumber, 20)) return res.status(400).json({ error: 'El precinto puede tener hasta 20 caracteres' });
    if (notes && !cleanText(notes, 255)) return res.status(400).json({ error: 'Las notas pueden tener hasta 255 caracteres' });

    try {
        const pool = await poolPromise;
        const current = await pool.request().input('id', sql.Int, id)
            .query('SELECT status, yard_location FROM container WHERE id = @id');
        const container = current.recordset[0];
        if (!container) return res.status(404).json({ error: 'Contenedor no encontrado' });
        if (container.status !== from) {
            return res.status(409).json({ error: `El contenedor está «${STATUS_LABELS[container.status]}»: solo se puede registrar desde «${STATUS_LABELS[from]}»` });
        }
        if (eventType === 'Moved' && container.yard_location === location) {
            return res.status(409).json({ error: 'El contenedor ya está en esa ubicación' });
        }

        await pool.request()
            .input('container_id', sql.Int, id)
            .input('event_type', sql.VarChar(10), eventType)
            // A departure keeps the last location in the history
            .input('yard_location', sql.VarChar(20), eventType === 'Departed' ? container.yard_location : location)
            .input('seal_number', sql.VarChar(20), sealNumber ? cleanText(sealNumber, 20) : null)
            .input('notes', sql.VarChar(255), notes ? cleanText(notes, 255) : null)
            .input('user_id', sql.Int, req.user.id)
            .execute('sp_register_container_event');
        res.json({ message });
    } catch (error) {
        internalError(res, error);
    }
};

exports.arrive = registerEvent({ eventType: 'Arrived', from: 'Expected', needsLocation: true, message: 'Llegada registrada' });
exports.move = registerEvent({ eventType: 'Moved', from: 'InYard', needsLocation: true, message: 'Movimiento registrado' });
exports.depart = registerEvent({ eventType: 'Departed', from: 'InYard', needsLocation: false, message: 'Salida registrada' });
