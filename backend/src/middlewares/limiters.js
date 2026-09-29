const rateLimit = require('express-rate-limit');

// Strict limit for the login: 5 failed attempts every 2 minutes per IP. Successful logins do not count.
const loginLimiter = rateLimit({
    windowMs: 2 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos fallidos. Espera 2 minutos e intenta de nuevo.' },
});

// Password recovery: asking for links is limited to 5 every 15 minutes per IP, using one to 10
const recoveryLimiter = (limit) => rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

module.exports = { loginLimiter, recoveryLimiter };
