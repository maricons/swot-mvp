const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('../config/db');
const { isPositiveInt, isText, internalError } = require('../utils/validate');
const { setActive, addCatalogFilters } = require('../utils/catalog');

// Drivers are the rows of app_user with role = 'driver'
const validate = (body, { passwordRequired }) => {
    const { name, email, password } = body || {};
    if (!isText(name, 100)) return { error: 'El nombre es obligatorio (máx. 100 caracteres)' };
    if (!isText(email, 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return { error: 'El correo no es válido' };
    }
    const hasPassword = typeof password === 'string' && password.length > 0;
    if ((passwordRequired || hasPassword) && (typeof password !== 'string' || password.length < 8 || password.length > 72)) {
        return { error: 'La contraseña debe tener entre 8 y 72 caracteres' };
    }
    return { data: { name: name.trim(), email: email.trim().toLowerCase(), password: hasPassword ? password : null } };
};

const emailTaken = async (pool, email, excludeId = 0) => {
    const r = await pool.request()
        .input('email', sql.VarChar(100), email)
        .input('id', sql.Int, excludeId)
        .query('SELECT id FROM app_user WHERE email = @email AND id <> @id');
    return r.recordset.length > 0;
};

exports.list = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const query = addCatalogFilters(request,
            `SELECT u.id, u.name, u.email, u.IsActive AS isActive,
                    (SELECT COUNT(*) FROM transport_order o WHERE o.driver_id = u.id) AS totalOrders
             FROM app_user u WHERE u.role = 'driver'`,
            req.query, ['name', 'email'], 'u');
        const result = await request.query(`${query} ORDER BY u.name`);
        res.json(result.recordset);
    } catch (error) {
        internalError(res, error);
    }
};

exports.create = async (req, res) => {
    const { data, error } = validate(req.body, { passwordRequired: true });
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        if (await emailTaken(pool, data.email)) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

        const result = await pool.request()
            .input('name', sql.VarChar(100), data.name)
            .input('email', sql.VarChar(100), data.email)
            .input('hash', sql.VarChar(255), await bcrypt.hash(data.password, 10))
            .query("INSERT INTO app_user (name, email, password_hash, role) OUTPUT INSERTED.id VALUES (@name, @email, @hash, 'driver')");
        res.status(201).json({ message: 'Conductor creado', id: result.recordset[0].id });
    } catch (err) {
        internalError(res, err);
    }
};

exports.update = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });
    const { data, error } = validate(req.body, { passwordRequired: false });
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        if (await emailTaken(pool, data.email, id)) return res.status(409).json({ error: 'Ya existe otro usuario con ese correo' });

        const request = pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.VarChar(100), data.name)
            .input('email', sql.VarChar(100), data.email);
        let setPassword = '';
        if (data.password) {
            request.input('hash', sql.VarChar(255), await bcrypt.hash(data.password, 10));
            setPassword = ', password_hash = @hash';
        }
        const result = await request.query(
            `UPDATE app_user SET name = @name, email = @email${setPassword} WHERE id = @id AND role = 'driver'`
        );
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Conductor no encontrado' });
        res.json({ message: 'Conductor actualizado' });
    } catch (err) {
        internalError(res, err);
    }
};

exports.setActive = setActive({ table: 'app_user', label: 'Conductor', extraWhere: "AND role = 'driver'" });
