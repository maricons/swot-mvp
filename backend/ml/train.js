// Generates SIMULATED orders, trains the OTIF-miss model on 80% of them and writes model.json.
// Run it from the backend folder:  npm run train
// The data is invented on purpose: there is no real history yet. Swap simulate() for a query on transport_order
// (miss = NOT (delivered_at <= due_date AND in_full)) once enough real orders exist.
const fs = require('fs');
const { MODEL_FILE, THRESHOLD, FEATURES, train, evaluate } = require('./model');

const SAMPLES = 5000;

// Small seeded random generator (mulberry32) so every run produces the same dataset and the same model
const seeded = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The "world" we pretend to observe. An order misses its OTIF when it is late OR incomplete:
// - late: longer distance, heavier cargo, less time, late booking and Monday deliveries (weekend backlog)
// - incomplete: more distinct products and heavier loads mean more chances of a shortage
// Both have random noise, so the outcome is never perfectly predictable (real life is not).
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
        const lateRisk = -3.0 + 0.014 * order.distanceKm + 0.0005 * order.weightKg - 0.45 * order.leadDays
            + 0.09 * Math.max(0, order.createdHour - 14) + 0.7 * order.dueOnMonday + (random() - 0.5) * 3;
        const shortageRisk = -3.4 + 0.3 * order.itemCount + 0.0004 * order.weightKg + (random() - 0.5) * 3;
        return { ...order, miss: lateRisk > 0 || shortageRisk > 0 };
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
    threshold: THRESHOLD,
    features: FEATURES,
    ...model,
}, null, 2));
console.log(`model.json written. On ${SAMPLES - split} orders it had not seen: accuracy ${(test.accuracy * 100).toFixed(1)}% (always saying "no miss": ${(test.baselineAccuracy * 100).toFixed(1)}%), precision ${(test.precision * 100).toFixed(0)}%, recall ${(test.recall * 100).toFixed(0)}%, AUC ${test.auc.toFixed(3)}`);
