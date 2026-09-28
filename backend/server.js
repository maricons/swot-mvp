require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authController = require('./src/controllers/authController');
const otController = require('./src/controllers/otController');
const authMiddleware = require('./src/middlewares/auth');

const app = express();
app.use(cors());
app.use(express.json());

// Rutas Públicas
app.post('/api/auth/login', authController.login);

// Rutas Protegidas (Requieren Token)
app.get('/api/ot', authMiddleware, otController.listarOT);
app.post('/api/ot', authMiddleware, otController.crearOT);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API corriendo en el puerto ${PORT}`);
});