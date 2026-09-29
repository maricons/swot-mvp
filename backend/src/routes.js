// Every API route and who can use it. Mounted at /api by server.js
const express = require('express');
const authController = require('./controllers/authController');
const orderController = require('./controllers/orderController');
const customerController = require('./controllers/customerController');
const vehicleController = require('./controllers/vehicleController');
const driverController = require('./controllers/driverController');
const productController = require('./controllers/productController');
const otifController = require('./controllers/otifController');
const alertController = require('./controllers/alertController');
const containerController = require('./controllers/containerController');
const fleetController = require('./controllers/fleetController');
const billingController = require('./controllers/billingController');
const predictionController = require('./controllers/predictionController');
const auth = require('./middlewares/auth');
const role = require('./middlewares/role');
const { loginLimiter, recoveryLimiter } = require('./middlewares/limiters');

const router = express.Router();

// Authentication (public)
router.post('/auth/login', loginLimiter, authController.login);
router.post('/auth/forgot-password', recoveryLimiter(5), authController.forgotPassword);
router.post('/auth/reset-password', recoveryLimiter(10), authController.resetPassword);

// Who can do what
const ADMIN = ['admin'];
const READ = ['dispatcher', 'supervisor', 'admin']; // everyone but drivers
const MANAGEMENT = ['supervisor', 'admin'];
// Container storage service: the yard operator works it, the admin manages it, the supervisor watches it
const YARD_READ = ['yard', 'supervisor', 'admin'];
const YARD_WRITE = ['yard', 'admin'];

// Orders. Export routes go before /:id so "export" is not read as an id
router.get('/orders', auth, role(READ), orderController.list);
router.get('/orders/export/excel', auth, role(READ), orderController.exportExcel);
router.get('/orders/export/pdf', auth, role(READ), orderController.exportPdf);
router.post('/orders', auth, role(['dispatcher']), orderController.create);
router.get('/orders/:id', auth, role([...READ, 'driver']), orderController.getDetail);
router.patch('/orders/:id/schedule', auth, role(['dispatcher']), orderController.schedule);
router.patch('/orders/:id/status', auth, role(['driver']), orderController.changeStatus);
router.get('/my-route', auth, role(['driver']), orderController.myRoute);
router.post('/my-route/position', auth, role(['driver']), fleetController.savePosition);
// Where the trucks in transit are (last position reported by each driver's phone)
router.get('/fleet', auth, role(MANAGEMENT), fleetController.getFleet);

// Customers, vehicles, drivers and products: everyone but drivers reads; only the admin writes
[
    ['customers', customerController],
    ['vehicles', vehicleController],
    ['drivers', driverController],
    ['products', productController],
].forEach(([path, controller]) => {
    // The yard operator also needs the customer list to register containers
    router.get(`/${path}`, auth, role(path === 'customers' ? [...READ, 'yard'] : READ), controller.list);
    router.post(`/${path}`, auth, role(ADMIN), controller.create);
    router.put(`/${path}/:id`, auth, role(ADMIN), controller.update);
    router.patch(`/${path}/:id/active`, auth, role(ADMIN), controller.setActive);
});

// Containers. summary goes before /:id so "summary" is not read as an id
router.get('/containers', auth, role(YARD_READ), containerController.list);
router.get('/containers/summary', auth, role(YARD_READ), containerController.summary);
router.post('/containers', auth, role(YARD_WRITE), containerController.create);
router.get('/containers/:id', auth, role(YARD_READ), containerController.getDetail);
router.put('/containers/:id', auth, role(YARD_WRITE), containerController.update);
router.post('/containers/:id/arrive', auth, role(YARD_WRITE), containerController.arrive);
router.post('/containers/:id/move', auth, role(YARD_WRITE), containerController.move);
router.post('/containers/:id/depart', auth, role(YARD_WRITE), containerController.depart);

// Storage billing (what each container costs past its free days) and the tariff behind it
router.get('/billing', auth, role(MANAGEMENT), billingController.getBilling);
router.get('/billing/export/excel', auth, role(MANAGEMENT), billingController.exportExcel);
router.get('/billing/export/pdf', auth, role(MANAGEMENT), billingController.exportPdf);
router.get('/storage-rates', auth, role(YARD_READ), billingController.getRates);
router.put('/storage-rates/:type', auth, role(ADMIN), billingController.updateRate);

// Late-delivery risk model (trained on simulated orders, see backend/ml)
router.get('/predictions/model', auth, role(READ), predictionController.getModel);
router.get('/predictions/open-orders', auth, role(READ), predictionController.openOrders);
router.post('/predictions/late-risk', auth, role(READ), predictionController.lateRisk);

// OTIF indicator and alerts
router.get('/otif', auth, role(MANAGEMENT), otifController.getOtif);
router.get('/otif/export/pdf', auth, role(MANAGEMENT), otifController.exportPdf);
router.get('/alerts', auth, role([...READ, 'yard']), alertController.getAlerts);

module.exports = router;
