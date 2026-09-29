const { sql, poolPromise } = require('../config/db');
const { normalizePlate, isDate, isPositiveInt, internalError } = require('../utils/validate');
const { setActive, addCatalogFilters } = require('../utils/catalog');

const validate = (body) => {
    const { plate, capacityKg, inspectionExpiry } = body || {};
    const normalizedPlate = normalizePlate(plate);
    if (!normalizedPlate) return { error: 'La patente no es válida (ej: AB1234 o ABCD12)' };
    if (typeof capacityKg !== 'number' || !(capacityKg > 0) || capacityKg > 100000) {
        return { error: 'La capacidad debe ser un número entre 0 y 100.000 kg' };
    }
    if (!isDate(inspectionExpiry)) return { error: 'El vencimiento de la revisión técnica debe ser una fecha (AAAA-MM-DD)' };
    return { data: { plate: normalizedPlate, capacityKg, inspectionExpiry } };
};

const plateTaken = async (pool, plate, excludeId = 0) => {
    const r = await pool.request()
        .input('plate', sql.VarChar(10), plate)
        .input('id', sql.Int, excludeId)
        .query('SELECT id FROM vehicle WHERE plate = @plate AND id <> @id');
    return r.recordset.length > 0;
};

exports.list = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const query = addCatalogFilters(request,
            `SELECT v.id, v.plate, v.capacity_kg AS capacityKg,
                    CONVERT(VARCHAR(10), v.inspection_expiry, 23) AS inspectionExpiry,
                    v.IsActive AS isActive,
                    CASE WHEN v.inspection_expiry >= CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS inspectionValid,
                    (SELECT COUNT(*) FROM transport_order o WHERE o.vehicle_id = v.id) AS totalOrders
             FROM vehicle v WHERE 1 = 1`,
            req.query, ['plate'], 'v');
        const result = await request.query(`${query} ORDER BY v.plate`);
        res.json(result.recordset);
    } catch (error) {
        internalError(res, error);
    }
};

exports.create = async (req, res) => {
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        if (await plateTaken(pool, data.plate)) {
            return res.status(409).json({ error: 'Ya existe un vehículo con esa patente' });
        }
        const result = await pool.request()
            .input('plate', sql.VarChar(10), data.plate)
            .input('capacityKg', sql.Decimal(10, 2), data.capacityKg)
            .input('inspectionExpiry', sql.Date, data.inspectionExpiry)
            .query('INSERT INTO vehicle (plate, capacity_kg, inspection_expiry) OUTPUT INSERTED.id VALUES (@plate, @capacityKg, @inspectionExpiry)');
        res.status(201).json({ message: 'Vehículo creado', id: result.recordset[0].id });
    } catch (err) {
        internalError(res, err);
    }
};

exports.update = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        if (await plateTaken(pool, data.plate, id)) {
            return res.status(409).json({ error: 'Ya existe otro vehículo con esa patente' });
        }
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('plate', sql.VarChar(10), data.plate)
            .input('capacityKg', sql.Decimal(10, 2), data.capacityKg)
            .input('inspectionExpiry', sql.Date, data.inspectionExpiry)
            .query('UPDATE vehicle SET plate = @plate, capacity_kg = @capacityKg, inspection_expiry = @inspectionExpiry WHERE id = @id');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Vehículo no encontrado' });
        res.json({ message: 'Vehículo actualizado' });
    } catch (err) {
        internalError(res, err);
    }
};

exports.setActive = setActive({ table: 'vehicle', label: 'Vehículo' });
