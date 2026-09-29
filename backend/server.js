require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authController = require('./src/controllers/authController');
const orderController = require('./src/controllers/orderController');
const customerController = require('./src/controllers/customerController');
const vehicleController = require('./src/controllers/vehicleController');
const driverController = require('./src/controllers/driverController');
const productController = require('./src/controllers/productController');
const otifController = require('./src/controllers/otifController');
const alertController = require('./src/controllers/alertController');
const containerController = require('./src/controllers/containerController');
const fleetController = require('./src/controllers/fleetController');
const auth = require('./src/middlewares/auth');
const role = require('./src/middlewares/role');

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

app.post('/api/auth/login', loginLimiter, authController.login);
app.post('/api/auth/forgot-password', recoveryLimiter(5), authController.forgotPassword);
app.post('/api/auth/reset-password', recoveryLimiter(10), authController.resetPassword);

// Who can do what
const ADMIN = ['admin'];
const READ = ['dispatcher', 'supervisor', 'admin']; // everyone but drivers
const MANAGEMENT = ['supervisor', 'admin'];
// Container storage service: the yard operator works it, the admin manages it, the supervisor watches it
const YARD_READ = ['yard', 'supervisor', 'admin'];
const YARD_WRITE = ['yard', 'admin'];

// Orders. Export routes go before /:id so "export" is not read as an id
app.get('/api/orders', auth, role(READ), orderController.list);
app.get('/api/orders/export/excel', auth, role(READ), orderController.exportExcel);
app.get('/api/orders/export/pdf', auth, role(READ), orderController.exportPdf);
app.post('/api/orders', auth, role(['dispatcher']), orderController.create);
app.get('/api/orders/:id', auth, role([...READ, 'driver']), orderController.getDetail);
app.patch('/api/orders/:id/schedule', auth, role(['dispatcher']), orderController.schedule);
app.patch('/api/orders/:id/status', auth, role(['driver']), orderController.changeStatus);
app.get('/api/my-route', auth, role(['driver']), orderController.myRoute);
app.post('/api/my-route/position', auth, role(['driver']), fleetController.savePosition);
// Where the trucks in transit are (last position reported by each driver's phone)
app.get('/api/fleet', auth, role(MANAGEMENT), fleetController.getFleet);

// Customers, vehicles, drivers and products: everyone but drivers reads; only the admin writes
[
    ['customers', customerController],
    ['vehicles', vehicleController],
    ['drivers', driverController],
    ['products', productController],
].forEach(([path, controller]) => {
    // The yard operator also needs the customer list to register containers
    app.get(`/api/${path}`, auth, role(path === 'customers' ? [...READ, 'yard'] : READ), controller.list);
    app.post(`/api/${path}`, auth, role(ADMIN), controller.create);
    app.put(`/api/${path}/:id`, auth, role(ADMIN), controller.update);
    app.patch(`/api/${path}/:id/active`, auth, role(ADMIN), controller.setActive);
});

// Containers. summary goes before /:id so "summary" is not read as an id
app.get('/api/containers', auth, role(YARD_READ), containerController.list);
app.get('/api/containers/summary', auth, role(YARD_READ), containerController.summary);
app.post('/api/containers', auth, role(YARD_WRITE), containerController.create);
app.get('/api/containers/:id', auth, role(YARD_READ), containerController.getDetail);
app.put('/api/containers/:id', auth, role(YARD_WRITE), containerController.update);
app.post('/api/containers/:id/arrive', auth, role(YARD_WRITE), containerController.arrive);
app.post('/api/containers/:id/move', auth, role(YARD_WRITE), containerController.move);
app.post('/api/containers/:id/depart', auth, role(YARD_WRITE), containerController.depart);

// OTIF indicator and alerts
app.get('/api/otif', auth, role(MANAGEMENT), otifController.getOtif);
app.get('/api/otif/export/pdf', auth, role(MANAGEMENT), otifController.exportPdf);
app.get('/api/alerts', auth, role([...READ, 'yard']), alertController.getAlerts);

// Unknown route
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en el puerto ${PORT}`);
});
