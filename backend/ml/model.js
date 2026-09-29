// OTIF-miss risk model: logistic regression in plain JavaScript (no ML library needed for 6 features).
// It answers "how likely is this order to miss its OTIF (arrive late OR incomplete)?" from data known when it is booked.
const fs = require('fs');
const path = require('path');

const MODEL_FILE = path.join(__dirname, 'model.json');

// Where the trucks leave from (simulated depot in Concón); distance to the customer is a feature
const DEPOT = { latitude: -32.9236, longitude: -71.517 };

// What the model looks at. Order matters: it is the order of the weights in model.json
const FEATURES = ['distanceKm', 'weightKg', 'leadDays', 'itemCount', 'createdHour', 'dueOnMonday'];

const toRad = (deg) => (deg * Math.PI) / 180;

// Straight-line distance in km between two points (haversine); real roads are longer, the model learns that
const haversineKm = (a, b) => {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// Trains with batch gradient descent on standardized features. Returns { weights, bias, means, stds }
const train = (rows, { epochs = 1500, rate = 0.3 } = {}) => {
    const n = rows.length;
    const means = FEATURES.map((f) => rows.reduce((sum, r) => sum + r[f], 0) / n);
    const stds = FEATURES.map((f, i) => Math.sqrt(rows.reduce((sum, r) => sum + (r[f] - means[i]) ** 2, 0) / n) || 1);
    const x = rows.map((r) => FEATURES.map((f, i) => (r[f] - means[i]) / stds[i]));
    const y = rows.map((r) => (r.miss ? 1 : 0));

    const weights = FEATURES.map(() => 0);
    let bias = 0;
    for (let epoch = 0; epoch < epochs; epoch++) {
        const grad = FEATURES.map(() => 0);
        let gradBias = 0;
        for (let i = 0; i < n; i++) {
            const error = sigmoid(bias + x[i].reduce((sum, v, j) => sum + v * weights[j], 0)) - y[i];
            for (let j = 0; j < grad.length; j++) grad[j] += error * x[i][j];
            gradBias += error;
        }
        for (let j = 0; j < weights.length; j++) weights[j] -= (rate * grad[j]) / n;
        bias -= (rate * gradBias) / n;
    }
    return { weights, bias, means, stds };
};

// Probability (0 to 1) that an order with these features misses its OTIF
const predict = (model, order) => {
    const z = FEATURES.reduce((sum, f, i) => sum + model.weights[i] * ((order[f] - model.means[i]) / model.stds[i]), model.bias);
    return sigmoid(z);
};

// The risk at which an order is flagged. Below 50% on purpose: missing an OTIF costs more than checking an order that was fine
const THRESHOLD = 0.4;

// Metrics on orders the model has not seen:
// - accuracy vs baseline (always answering "no miss"), so a good-looking number cannot come from an unbalanced target
// - precision (of the flagged orders, how many really missed) and recall (of the misses, how many were flagged)
// - AUC (chance that a missed order gets more risk than a fulfilled one; 0.5 = coin flip)
// - top20: share of all misses that fall in the 20% of orders with the highest risk (what a dispatcher checking those would catch)
const evaluate = (model, rows) => {
    const scored = rows.map((r) => ({ p: predict(model, r), miss: r.miss })).sort((a, b) => b.p - a.p);
    const flagged = scored.filter((s) => s.p >= THRESHOLD);
    const misses = scored.filter((s) => s.miss);
    const hits = flagged.filter((s) => s.miss).length;
    const fulfilled = scored.filter((s) => !s.miss);
    let wins = 0;
    for (const a of misses) for (const b of fulfilled) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;
    const top = scored.slice(0, Math.ceil(scored.length * 0.2));
    return {
        accuracy: scored.filter((s) => (s.p >= THRESHOLD) === s.miss).length / scored.length,
        baselineAccuracy: fulfilled.length / scored.length,
        precision: flagged.length ? hits / flagged.length : 0,
        recall: hits / misses.length,
        auc: wins / (misses.length * fulfilled.length),
        top20: top.filter((s) => s.miss).length / misses.length,
        missShare: misses.length / scored.length,
    };
};

const loadModel = () => JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));

module.exports = { MODEL_FILE, DEPOT, THRESHOLD, FEATURES, haversineKm, train, predict, evaluate, loadModel };
