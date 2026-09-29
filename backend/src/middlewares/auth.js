const jwt = require('jsonwebtoken');
const { sql, poolPromise } = require('../config/db');

module.exports = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token no proveído' });

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Token inválido' });
    }

    try {
        // The role and the active flag come from the database, so a deactivated or demoted user
        // loses access right away, even with a token that has not expired
        const pool = await poolPromise;
        const { recordset } = await pool.request()
            .input('id', sql.Int, payload.id)
            .query('SELECT role, IsActive FROM app_user WHERE id = @id');
        if (!recordset[0]?.IsActive) return res.status(401).json({ error: 'Cuenta desactivada' });
        req.user = { id: payload.id, role: recordset[0].role };
        next();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
