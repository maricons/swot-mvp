const { sql, poolPromise } = require('../config/db');
const { isPositiveInt, internalError } = require('./validate');

// PATCH handler that soft-deletes (or restores) a row, so the order history is kept.
// The body must carry { isActive: boolean }. table and extraWhere come from the code, never from the request.
const setActive = ({ table, label, extraWhere = '' }) => async (req, res) => {
    const id = Number(req.params.id);
    const { isActive } = req.body || {};
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });
    if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive debe ser true o false' });

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('value', sql.Bit, isActive)
            .query(`UPDATE ${table} SET IsActive = @value WHERE id = @id ${extraWhere}`);
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: `${label} no encontrado` });
        res.json({ message: isActive ? `${label} activado` : `${label} desactivado` });
    } catch (error) {
        internalError(res, error);
    }
};

// Adds the optional ?search= and ?active=1|0 filters of the catalog lists to a query.
// searchColumns are fixed column names written in the code.
const addCatalogFilters = (request, query, { search, active }, searchColumns, alias) => {
    let sqlText = query;
    if (typeof search === 'string' && search.trim()) {
        request.input('search', sql.VarChar(100), `%${search.trim()}%`);
        sqlText += ` AND (${searchColumns.map((c) => `${alias}.${c} LIKE @search`).join(' OR ')})`;
    }
    if (active === '1' || active === '0') {
        request.input('active', sql.Bit, active === '1');
        sqlText += ` AND ${alias}.IsActive = @active`;
    }
    return sqlText;
};

module.exports = { setActive, addCatalogFilters };
