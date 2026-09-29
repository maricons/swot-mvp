const crypto = require('crypto');
const { sql, poolPromise } = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendMail } = require('../utils/mailer');

// Fake hash: it is compared even when the email does not exist, so the answer takes the same time
// and nobody can guess which emails are registered.
const FAKE_HASH = '$2b$10$fYxxCwHs7fFSnBYC0ddIBOwgp1MJqxMMLVwH7/7RRnVRDi5eqc1gO';
const RESET_MINUTES = 30;

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

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0];

// Step 1 of the recovery: the user asks for a link. The answer is always the same, whether the email is
// registered or not, so this cannot be used to find out who has an account.
exports.forgotPassword = async (req, res) => {
    const { email } = req.body || {};
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
        return res.status(400).json({ error: 'Ingresa un correo válido' });
    }

    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request()
            .input('email', sql.VarChar(100), email.trim().toLowerCase())
            .query('SELECT id FROM app_user WHERE email = @email AND IsActive = 1');

        if (recordset[0]) {
            // A random token: only its hash is stored, and the previous unused links stop working
            const token = crypto.randomBytes(32).toString('hex');
            await pool.request()
                .input('userId', sql.Int, recordset[0].id)
                .input('hash', sql.Char(64), hashToken(token))
                .input('minutes', sql.Int, RESET_MINUTES)
                .query(`DELETE FROM password_reset WHERE user_id = @userId AND used_at IS NULL;
                        INSERT INTO password_reset (user_id, token_hash, expires_at)
                        VALUES (@userId, @hash, DATEADD(MINUTE, @minutes, GETDATE()))`);

            // Not awaited, so the answer takes the same time for registered and unknown emails
            sendMail({
                to: email,
                subject: 'Restablece tu contraseña de SWOT',
                text: `Recibimos una solicitud para restablecer tu contraseña.\n\nAbre este enlace (vence en ${RESET_MINUTES} minutos y sirve una sola vez):\n${frontendUrl()}/reset-password?token=${token}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambia.`,
            }).catch((error) => console.error('No se pudo enviar el correo:', error.message));
        }
        res.json({ message: `Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Vence en ${RESET_MINUTES} minutos.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Step 2: the user opens the link and chooses a new password. The link works once; afterwards every session
// that was open with the old password stops working (see the auth middleware).
exports.resetPassword = async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: 'El enlace no es válido o ya venció. Pide uno nuevo.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 72 caracteres' });
    }

    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request()
            .input('hash', sql.Char(64), hashToken(token))
            .query(`SELECT r.id, r.user_id FROM password_reset r JOIN app_user u ON u.id = r.user_id
                    WHERE r.token_hash = @hash AND r.used_at IS NULL AND r.expires_at > GETDATE() AND u.IsActive = 1`);
        if (!recordset[0]) return res.status(400).json({ error: 'El enlace no es válido o ya venció. Pide uno nuevo.' });

        await pool.request()
            .input('reset_id', sql.Int, recordset[0].id)
            .input('user_id', sql.Int, recordset[0].user_id)
            .input('password_hash', sql.VarChar(255), await bcrypt.hash(password, 10))
            .execute('sp_reset_password');
        res.json({ message: 'Tu contraseña se actualizó. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
