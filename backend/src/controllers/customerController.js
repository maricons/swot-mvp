const { sql, poolPromise } = require('../config/db');
const { normalizeTaxId, isPositiveInt, isText, internalError } = require('../utils/validate');
const { setActive, addCatalogFilters } = require('../utils/catalog');

// Validates and cleans the body of create/update. Returns { data } or { error }.
const validate = (body) => {
    const { name, taxId, address, latitude, longitude } = body || {};
    if (!isText(name, 100)) return { error: 'El nombre es obligatorio (máx. 100 caracteres)' };
    if (!isText(address, 255)) return { error: 'La dirección es obligatoria (máx. 255 caracteres)' };
    const normalized = normalizeTaxId(taxId);
    if (!normalized) return { error: 'El RUT no es válido (ej: 76.123.456-0)' };

    // The delivery point on the map: both coordinates or none
    const hasLatitude = latitude !== undefined && latitude !== null;
    const hasLongitude = longitude !== undefined && longitude !== null;
    if (hasLatitude !== hasLongitude) return { error: 'Indica la latitud y la longitud, o ninguna de las dos' };
    if (hasLatitude && (typeof latitude !== 'number' || typeof longitude !== 'number' || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
        return { error: 'La ubicación no es válida (latitud entre -90 y 90, longitud entre -180 y 180)' };
    }
    return {
        data: {
            name: name.trim(), address: address.trim(), taxId: normalized,
            latitude: hasLatitude ? latitude : null, longitude: hasLongitude ? longitude : null,
        },
    };
};

// Is there another customer with this RUT?
const taxIdTaken = async (pool, taxId, excludeId = 0) => {
    const r = await pool.request()
        .input('taxId', sql.VarChar(20), taxId)
        .input('id', sql.Int, excludeId)
        .query('SELECT id FROM customer WHERE tax_id = @taxId AND id <> @id');
    return r.recordset.length > 0;
};

exports.list = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const query = addCatalogFilters(request,
            `SELECT c.id, c.name, c.tax_id AS taxId, c.address, c.latitude, c.longitude, c.IsActive AS isActive,
                    (SELECT COUNT(*) FROM transport_order o WHERE o.customer_id = c.id) AS totalOrders
             FROM customer c WHERE 1 = 1`,
            req.query, ['name', 'tax_id'], 'c');
        const result = await request.query(`${query} ORDER BY c.name`);
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
        if (await taxIdTaken(pool, data.taxId)) {
            return res.status(409).json({ error: 'Ya existe un cliente con ese RUT' });
        }
        const result = await pool.request()
            .input('name', sql.VarChar(100), data.name)
            .input('address', sql.VarChar(255), data.address)
            .input('taxId', sql.VarChar(20), data.taxId)
            .input('latitude', sql.Decimal(9, 6), data.latitude)
            .input('longitude', sql.Decimal(9, 6), data.longitude)
            .query('INSERT INTO customer (name, address, tax_id, latitude, longitude) OUTPUT INSERTED.id VALUES (@name, @address, @taxId, @latitude, @longitude)');
        res.status(201).json({ message: 'Cliente creado', id: result.recordset[0].id });
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
        if (await taxIdTaken(pool, data.taxId, id)) {
            return res.status(409).json({ error: 'Ya existe otro cliente con ese RUT' });
        }
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.VarChar(100), data.name)
            .input('address', sql.VarChar(255), data.address)
            .input('taxId', sql.VarChar(20), data.taxId)
            .input('latitude', sql.Decimal(9, 6), data.latitude)
            .input('longitude', sql.Decimal(9, 6), data.longitude)
            .query('UPDATE customer SET name = @name, address = @address, tax_id = @taxId, latitude = @latitude, longitude = @longitude WHERE id = @id');
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
        res.json({ message: 'Cliente actualizado' });
    } catch (err) {
        internalError(res, err);
    }
};

// Activate / deactivate (soft delete): the order history is kept
exports.setActive = setActive({ table: 'customer', label: 'Cliente' });
