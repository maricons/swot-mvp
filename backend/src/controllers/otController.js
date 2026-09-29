const { sql, poolPromise } = require('../config/db');

exports.listarOT = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM orden_transporte');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.crearOT = async (req, res) => {
    const { cliente_id, peso_kg } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('cliente_id', sql.Int, cliente_id)
            .input('peso_kg', sql.Decimal(10,2), peso_kg)
            .input('usuario_id', sql.Int, req.user.id)
            .execute('sp_crear_ot');
        
        res.status(201).json({ 
            message: 'OT Creada exitosamente', 
            id_ot_nueva: result.recordset[0].id_ot_nueva 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.programarOT = async (req, res) => {
    const { id } = req.params;
    const { vehiculo_id, conductor_id } = req.body;
    try {
        const pool = await poolPromise;
        
        const ot = await pool.request().input('id', sql.Int, id).query('SELECT peso_kg FROM orden_transporte WHERE id = @id');
        const vehiculo = await pool.request().input('id', sql.Int, vehiculo_id).query('SELECT capacidad_kg, vencimiento_rt FROM vehiculo WHERE id = @id');
        
        if (!ot.recordset[0] || !vehiculo.recordset[0]) return res.status(404).json({ error: 'OT o Vehículo no encontrado' });
        
        // Validaciones requeridas
        if (ot.recordset[0].peso_kg > vehiculo.recordset[0].capacidad_kg) {
            return res.status(409).json({ error: 'Camión sin capacidad' });
        }
        if (new Date(vehiculo.recordset[0].vencimiento_rt) < new Date()) {
            return res.status(409).json({ error: 'Revisión técnica vencida' });
        }

        await pool.request()
            .input('ot_id', sql.Int, id)
            .input('vehiculo_id', sql.Int, vehiculo_id)
            .input('conductor_id', sql.Int, conductor_id)
            .input('usuario_id', sql.Int, req.user.id)
            .execute('sp_programar_ot');
        
        res.json({ message: 'OT Programada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.cambiarEstado = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body; // 'En ruta', 'Entregada', 'Fallida'
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('ot_id', sql.Int, id)
            .input('nuevo_estado', sql.VarChar, estado)
            .input('usuario_id', sql.Int, req.user.id)
            .execute('sp_cambiar_estado_ot');
        res.json({ message: `Estado actualizado a ${estado}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.obtenerDetalle = async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        const ot = await pool.request().input('id', sql.Int, id).query('SELECT * FROM orden_transporte WHERE id = @id');
        const historial = await pool.request().input('ot_id', sql.Int, id).query('SELECT * FROM ot_historial WHERE ot_id = @ot_id ORDER BY fecha_cambio DESC');
        res.json({ detalle: ot.recordset[0], historial: historial.recordset });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.hojaRuta = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('conductor_id', sql.Int, req.user.id)
            .query("SELECT * FROM orden_transporte WHERE usuario_conductor_id = @conductor_id AND estado IN ('Programada', 'En ruta')");
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};