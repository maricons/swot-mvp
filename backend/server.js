require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./src/routes');

if (!process.env.JWT_SECRET) {
    console.error('Falta JWT_SECRET en el archivo .env');
    process.exit(1);
}

const app = express();

// Security headers
app.use(helmet());

// CORS: only the allowed frontend (change it with FRONTEND_URL in .env, comma separated)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));

// Pictures travel inside the JSON body, so those routes accept a bigger one; everything else stays small
app.use('/api/products', express.json({ limit: '300kb' }));
app.use('/api/orders/:id/status', express.json({ limit: '600kb' }));
app.use(express.json({ limit: '10kb' }));

// General limit: 300 requests every 15 minutes per IP
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta más tarde.' },
}));

app.use('/api', routes);

// Unknown route
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en el puerto ${PORT}`);
});
