// Status and role codes are English in the database and the API; the screens show them in Spanish
export const STATUS_LABELS = {
    Created: 'Creada', Scheduled: 'Programada', InTransit: 'En ruta', Delivered: 'Entregada', Failed: 'Fallida',
};
export const STATUS_PLURALS = {
    Created: 'Creadas', Scheduled: 'Programadas', InTransit: 'En ruta', Delivered: 'Entregadas', Failed: 'Fallidas',
};
export const ROLE_LABELS = {
    dispatcher: 'Despachador', driver: 'Conductor', admin: 'Administrador', supervisor: 'Supervisor',
};

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
