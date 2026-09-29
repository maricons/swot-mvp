const { poolPromise } = require('../config/db');
const { DEPOT, FEATURES, haversineKm, predict, loadModel } = require('../../ml/model');
const { internalError } = require('../utils/validate');

const model = loadModel();

// Allowed range of each what-if value (the same span the model was trained on, a bit wider)
const LIMITS = { distanceKm: [0, 500], weightKg: [1, 30000], leadDays: [0, 60], itemCount: [1, 200], createdHour: [0, 23], dueOnMonday: [0, 1] };

const level = (p) => (p >= 0.7 ? 'high' : p >= 0.4 ? 'medium' : 'low');
const risk = (order) => {
    const probability = predict(model, order);
    return { probability: Math.round(probability * 100) / 100, level: level(probability) };
};

// The model card: how it was trained, how well it does on orders it had not seen, and what pushes the risk up or down
exports.getModel = (req, res) => {
    const { trainedOn, samples, trainSize, testSize, metrics, weights, features } = model;
    res.json({
        trainedOn, samples, trainSize, testSize, metrics,
        // Weights are on standardized features, so they can be compared: positive = more risk, negative = less
        influence: features.map((feature, i) => ({ feature, weight: Math.round(weights[i] * 100) / 100 })),
    });
};

// What-if: risk of an order described by hand
exports.lateRisk = (req, res) => {
    const order = {};
    for (const feature of FEATURES) {
        const value = req.body?.[feature];
        const [min, max] = LIMITS[feature];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
            return res.status(400).json({ error: `${feature} debe ser un número entre ${min} y ${max}` });
        }
        order[feature] = value;
    }
    res.json(risk(order));
};

// Risk of every order that is still open and has a promised date, highest first
exports.openOrders = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { recordset } = await pool.request().query(
            `SELECT o.id, cu.name AS customerName, o.status, o.weight_kg AS weightKg,
                    CONVERT(VARCHAR(10), o.due_date, 23) AS dueDate, cu.latitude, cu.longitude,
                    DATEDIFF(DAY, CAST(o.created_at AS DATE), o.due_date) AS leadDays,
                    DATEPART(HOUR, o.created_at) AS createdHour,
                    CASE WHEN DATEDIFF(DAY, '19000101', o.due_date) % 7 = 0 THEN 1 ELSE 0 END AS dueOnMonday,
                    (SELECT COUNT(*) FROM order_item i WHERE i.order_id = o.id) AS itemCount
             FROM transport_order o JOIN customer cu ON cu.id = o.customer_id
             WHERE o.status IN ('Created', 'Scheduled', 'InTransit') AND o.due_date IS NOT NULL`
        );
        const rows = recordset.map((o) => {
            // Customers without a map point get the average distance the model saw
            const distanceKm = o.latitude == null ? model.means[0] : haversineKm(DEPOT, o);
            const features = { distanceKm: Math.round(distanceKm), weightKg: Number(o.weightKg), leadDays: Math.max(0, o.leadDays), itemCount: Math.max(1, o.itemCount), createdHour: o.createdHour, dueOnMonday: o.dueOnMonday };
            return { id: o.id, customerName: o.customerName, status: o.status, dueDate: o.dueDate, ...features, ...risk(features) };
        });
        res.json(rows.sort((a, b) => b.probability - a.probability));
    } catch (error) {
        internalError(res, error);
    }
};
