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

// ISO 6346 container number: 4 letters (owner code + category), 6 digits and a check digit.
// Letter values start at 10 and skip the multiples of 11; each character is weighted by 2^position.
const letterValue = (letter) => {
    let value = 10;
    for (const candidate of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (value % 11 === 0) value++;
        if (candidate === letter) return value;
        value++;
    }
    return 0;
};

// Returns the number without spaces or hyphens in upper case, or null when it is not a valid ISO 6346 number
const normalizeContainerNumber = (text) => {
    if (typeof text !== 'string') return null;
    const clean = text.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(clean)) return null;
    const sum = [...clean.slice(0, 10)].reduce((total, char, i) => total + (/\d/.test(char) ? Number(char) : letterValue(char)) * 2 ** i, 0);
    return (sum % 11) % 10 === Number(clean[10]) ? clean : null;
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
    normalizeTaxId, normalizePlate, normalizeContainerNumber, isDate, isPositiveInt, isText, isImage, internalError,
};
