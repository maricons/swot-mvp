// Validations and normalizations shared by the controllers

// Check digit of a Chilean RUT (modulo 11)
const checkDigit = (body) => {
    let sum = 0;
    let factor = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += Number(body[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const rest = 11 - (sum % 11);
    if (rest === 11) return '0';
    if (rest === 10) return 'K';
    return String(rest);
};

// Returns the RUT formatted as 12.345.678-5, or null when it is not valid
const normalizeTaxId = (text) => {
    if (typeof text !== 'string') return null;
    const clean = text.replace(/[.\s]/g, '').toUpperCase();
    const parts = clean.match(/^(\d{7,8})-([\dK])$/);
    if (!parts) return null;
    const [, body, digit] = parts;
    if (checkDigit(body) !== digit) return null;
    return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digit}`;
};

// Chilean plates: AB1234 (old) or ABCD12 (new)
const normalizePlate = (text) => {
    if (typeof text !== 'string') return null;
    const clean = text.replace(/[\s-]/g, '').toUpperCase();
    return /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2})$/.test(clean) ? clean : null;
};

const isDate = (text) => typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text));
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

// Pictures travel as data URLs; the browser shrinks them first, so the length cap is only a safety net
const isImage = (value, maxLength) =>
    typeof value === 'string' && value.length <= maxLength && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);

// Internal errors are logged on the server and never shown to the user
const internalError = (res, error) => {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
};

module.exports = {
    normalizeTaxId, normalizePlate, isDate, isPositiveInt, isText, isImage, internalError,
};
