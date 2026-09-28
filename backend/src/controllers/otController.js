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