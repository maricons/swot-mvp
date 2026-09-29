const { sql, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Fake hash: it is compared even when the email does not exist, so the answer takes the same time
// and nobody can guess which emails are registered.
const FAKE_HASH = '$2b$10$fYxxCwHs7fFSnBYC0ddIBOwgp1MJqxMMLVwH7/7RRnVRDi5eqc1gO';

exports.login = async (req, res) => {
    const { email, password } = req.body || {};

    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password || email.length > 100) {
        return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    try {
        const pool = await poolPromise;
        // Parameterized query: what the user types is never pasted into the SQL
        const result = await pool.request()
            .input('email', sql.VarChar(100), email)
            .query('SELECT id, role, password_hash, IsActive FROM app_user WHERE email = @email');

        const user = result.recordset[0];
        const matches = await bcrypt.compare(password, user ? user.password_hash : FAKE_HASH);

        if (!user || !matches) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        if (!user.IsActive) {
            return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, role: user.role });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
