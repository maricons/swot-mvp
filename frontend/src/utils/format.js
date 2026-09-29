// Status and role codes are English in the database and the API; the screens show them in Spanish
export const STATUS_LABELS = {
    Created: 'Creada', Scheduled: 'Programada', InTransit: 'En ruta', Delivered: 'Entregada', Failed: 'Fallida',
};
export const STATUS_PLURALS = {
    Created: 'Creadas', Scheduled: 'Programadas', InTransit: 'En ruta', Delivered: 'Entregadas', Failed: 'Fallidas',
};
export const ROLE_LABELS = {
    dispatcher: 'Despachador', driver: 'Conductor', admin: 'Administrador', supervisor: 'Supervisor', yard: 'Operador de patio',
};

// The screen each role lands on after logging in
export const homeRoute = (role) => ({ driver: '/route', yard: '/containers' })[role] || '/orders';

// Container storage service
export const CONTAINER_STATUS_LABELS = { Expected: 'Esperado', InYard: 'En patio', Departed: 'Retirado' };
export const CARGO_LABELS = { dry: 'Seca', perishable: 'Perecedera' };
export const CONTAINER_TYPES = [
    ['20DV', "20' estándar"], ['40DV', "40' estándar"], ['40HC', "40' High Cube"], ['20RF', "20' refrigerado"], ['40RF', "40' refrigerado"],
];
export const EVENT_LABELS = { Announced: 'Anunciado', Arrived: 'Llegó al patio', Moved: 'Movido de posición', Departed: 'Salió del patio' };

// "MSCU1234566" -> "MSCU 123456-6"
export const formatContainerNumber = (number) => (number ? `${number.slice(0, 4)} ${number.slice(4, 10)}-${number.slice(10)}` : '');

// Formats as the user types: keeps letters and digits, upper case, up to 11 characters
export const formatContainerInput = (value) => formatContainerNumber(value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, 11)).replace(/[ -]+$/, '');

// 36000 -> "$36.000" (Chilean pesos)
export const formatMoney = (amount) => `$${Number(amount).toLocaleString('es-CL')}`;

// "2027-12-31" -> "31-12-2027" (dates without time come as text from the API, so no time zone can shift them)
export const formatDay = (day) => (day ? day.split('-').reverse().join('-') : '—');

export const formatDate = (value) => new Date(value).toLocaleDateString('es-CL');
export const formatDateTime = (value) => new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });

// "25 kg" for a product with content, empty text for one without
export const formatContent = (p) =>
    p.contentAmount == null ? '' : `${Number(p.contentAmount).toLocaleString('es-CL')} ${p.contentUnit}`;

// "Cement bag · 25 kg"
export const productLabel = (p) => [p.name, formatContent(p)].filter(Boolean).join(' · ');

// Formats a RUT as the user types: "123456785" -> "12.345.678-5"
export const formatTaxId = (value) => {
    const clean = value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
    if (clean.length < 2) return clean;
    const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${body}-${clean.slice(-1)}`;
};

// Shrinks a picture in the browser so it can travel as text (longest side max px, JPEG)
export const resizeImage = (file, max = 320, quality = 0.8) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = url;
});

// Downloads a file from an endpoint that needs the auth header (a plain link cannot send it)
export const downloadFile = async (api, url, params, filename) => {
    const { data } = await api.get(url, { params, responseType: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
};
