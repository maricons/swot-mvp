const { sql, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query('SELECT id, nombre, rol, password_hash FROM usuario WHERE email = @email');

        const user = result.recordset[0];
        // En este MVP simulamos la validación del hash directamente
        if (!user || user.password_hash !== password) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, rol: user.rol });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};