const { sql, poolPromise } = require('../config/db');
const { isPositiveInt, isText, isImage, internalError } = require('../utils/validate');
const { setActive, addCatalogFilters } = require('../utils/catalog');

const CONTENT_UNITS = ['mg', 'g', 'kg', 'ml', 'L'];
const MAX_PHOTO_LENGTH = 150000; // the browser shrinks the picture first (~110 KB of image)

// photo: undefined = leave as is (edit), null = remove, string = new picture
const validate = (body) => {
    const { name, unit, contentAmount, contentUnit, weightKg, photo } = body || {};
    if (!isText(name, 100)) return { error: 'El nombre es obligatorio (máx. 100 caracteres)' };
    if (!isText(unit, 20)) return { error: 'La presentación es obligatoria (ej: unidad, caja, saco)' };

    const hasAmount = contentAmount !== undefined && contentAmount !== null && contentAmount !== '';
    const hasUnit = contentUnit !== undefined && contentUnit !== null && contentUnit !== '';
    if (hasAmount !== hasUnit) return { error: 'El contenido necesita cantidad y unidad de medida' };
    if (hasAmount && (typeof contentAmount !== 'number' || !(contentAmount > 0) || contentAmount > 1000000
        || !CONTENT_UNITS.includes(contentUnit))) {
        return { error: `El contenido debe ser un número mayor que 0 con unidad ${CONTENT_UNITS.join(', ')}` };
    }
    // Shipping weight of one package: its own field, never derived from the content (500 mg of active is not the weight)
    if (weightKg !== undefined && weightKg !== null && (typeof weightKg !== 'number' || !(weightKg > 0) || weightKg > 100000)) {
        return { error: 'El peso por presentación debe ser un número mayor que 0 (kg)' };
    }
    if (typeof photo === 'string' && !isImage(photo, MAX_PHOTO_LENGTH)) {
        return { error: 'La foto no es válida (usa una imagen JPG, PNG o WEBP)' };
    }
    return {
        data: {
            name: name.trim(),
            unit: unit.trim(),
            contentAmount: hasAmount ? contentAmount : null,
            contentUnit: hasUnit ? contentUnit : null,
            weightKg: weightKg ?? null,
            photo,
        },
    };
};

exports.list = async (req, res) => {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const query = addCatalogFilters(request,
            `SELECT p.id, p.name, p.unit, p.content_amount AS contentAmount, p.content_unit AS contentUnit,
                    p.weight_kg AS weightKg, p.photo, p.IsActive AS isActive,
                    (SELECT COUNT(*) FROM order_item i WHERE i.product_id = p.id) AS totalOrders
             FROM product p WHERE 1 = 1`,
            req.query, ['name'], 'p');
        const result = await request.query(`${query} ORDER BY p.name`);
        res.json(result.recordset);
    } catch (error) {
        internalError(res, error);
    }
};

exports.create = async (req, res) => {
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('name', sql.VarChar(100), data.name)
            .input('unit', sql.VarChar(20), data.unit)
            .input('amount', sql.Decimal(12, 3), data.contentAmount)
            .input('contentUnit', sql.VarChar(5), data.contentUnit)
            .input('weight', sql.Decimal(12, 3), data.weightKg)
            .input('photo', sql.VarChar(sql.MAX), data.photo || null)
            .query('INSERT INTO product (name, unit, content_amount, content_unit, weight_kg, photo) OUTPUT INSERTED.id VALUES (@name, @unit, @amount, @contentUnit, @weight, @photo)');
        res.status(201).json({ message: 'Producto creado', id: result.recordset[0].id });
    } catch (err) {
        internalError(res, err);
    }
};

exports.update = async (req, res) => {
    const id = Number(req.params.id);
    if (!isPositiveInt(id)) return res.status(400).json({ error: 'Id no válido' });
    const { data, error } = validate(req.body);
    if (error) return res.status(400).json({ error });

    try {
        const pool = await poolPromise;
        const request = pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.VarChar(100), data.name)
            .input('unit', sql.VarChar(20), data.unit)
            .input('amount', sql.Decimal(12, 3), data.contentAmount)
            .input('contentUnit', sql.VarChar(5), data.contentUnit)
            .input('weight', sql.Decimal(12, 3), data.weightKg);
        let setPhoto = '';
        if (data.photo !== undefined) {
            request.input('photo', sql.VarChar(sql.MAX), data.photo);
            setPhoto = ', photo = @photo';
        }
        const result = await request.query(
            `UPDATE product SET name = @name, unit = @unit, content_amount = @amount, content_unit = @contentUnit, weight_kg = @weight${setPhoto} WHERE id = @id`
        );
        if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ message: 'Producto actualizado' });
    } catch (err) {
        internalError(res, err);
    }
};

exports.setActive = setActive({ table: 'product', label: 'Producto' });
