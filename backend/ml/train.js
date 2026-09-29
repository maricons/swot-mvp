// Generates SIMULATED orders, trains the late-delivery model on 80% of them and writes model.json.
// Run it from the backend folder:  npm run train
// The data is invented on purpose: there is no real history yet. Swap simulate() for a query on transport_order
// (delivered_at > due_date) once enough real orders exist.
const fs = require('fs');
const { MODEL_FILE, FEATURES, train, evaluate } = require('./model');

const SAMPLES = 5000;

// Small seeded random generator (mulberry32) so every run produces the same dataset and the same model
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The "world" we pretend to observe: longer distance, heavier cargo, less time, many items, late booking and
// deliveries promised for Monday (weekend backlog) make a delay more likely. Plus noise, so it is not perfectly predictable.
const simulate = (count) => {
    const random = seeded(2026);
    const between = (min, max) => min + random() * (max - min);
    return Array.from({ length: count }, () => {
        const order = {
            distanceKm: Math.round(between(3, 180)),
            weightKg: Math.round(between(50, 4500)),
            leadDays: Math.floor(between(0, 9)),
            itemCount: 1 + Math.floor(between(0, 8)),
            createdHour: Math.floor(between(7, 20)),
            dueOnMonday: random() < 0.15 ? 1 : 0,
        };
        const risk = -3.0 + 0.014 * order.distanceKm + 0.0005 * order.weightKg - 0.45 * order.leadDays
            + 0.18 * order.itemCount + 0.09 * Math.max(0, order.createdHour - 14) + 0.7 * order.dueOnMonday + (random() - 0.5) * 2.4;
        return { ...order, late: risk > 0 };
    });
};

const rows = simulate(SAMPLES);
const split = Math.floor(SAMPLES * 0.8);
const model = train(rows.slice(0, split));
const test = evaluate(model, rows.slice(split));

fs.writeFileSync(MODEL_FILE, JSON.stringify({
    trainedOn: 'simulated orders',
    samples: SAMPLES,
    trainSize: split,
    testSize: SAMPLES - split,
    metrics: test,
    features: FEATURES,
    ...model,
}, null, 2));
console.log(`model.json written. On ${SAMPLES - split} orders it had not seen: accuracy ${(test.accuracy * 100).toFixed(1)}%, AUC ${test.auc.toFixed(3)}`);
