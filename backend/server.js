require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authController = require('./src/controllers/authController');
const otController = require('./src/controllers/otController');
const authMiddleware = require('./src/middlewares/auth');
const roleMiddleware = require('./src/middlewares/role');

const app = express();
app.use(cors());
app.use(express.json());

// Ruta Pública
app.post('/api/auth/login', authController.login);

// Rutas exclusivas del Despachador
app.get('/api/ot', authMiddleware, roleMiddleware(['despachador']), otController.listarOT);
app.post('/api/ot', authMiddleware, roleMiddleware(['despachador']), otController.crearOT);
app.patch('/api/ot/:id/programar', authMiddleware, roleMiddleware(['despachador']), otController.programarOT);

// Rutas exclusivas del Conductor
app.get('/api/hoja-ruta', authMiddleware, roleMiddleware(['conductor']), otController.hojaRuta);
app.patch('/api/ot/:id/estado', authMiddleware, roleMiddleware(['conductor']), otController.cambiarEstado);

// Rutas compartidas por Ambos
app.get('/api/ot/:id', authMiddleware, roleMiddleware(['despachador', 'conductor']), otController.obtenerDetalle);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en el puerto ${PORT}`);
});