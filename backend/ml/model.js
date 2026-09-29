// Late-delivery risk model: logistic regression in plain JavaScript (no ML library needed for 6 features).
// It answers "how likely is this order to be delivered after its promised date?" from data known when it is booked.
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
    const y = rows.map((r) => (r.late ? 1 : 0));

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

// Probability (0 to 1) that an order with these features is late
const predict = (model, order) => {
    const z = FEATURES.reduce((sum, f, i) => sum + model.weights[i] * ((order[f] - model.means[i]) / model.stds[i]), model.bias);
    return sigmoid(z);
};

// Accuracy at 50% and AUC (chance that a late order gets a higher risk than an on-time one; 0.5 = coin flip)
const evaluate = (model, rows) => {
    const scored = rows.map((r) => ({ p: predict(model, r), late: r.late }));
    const accuracy = scored.filter((s) => (s.p >= 0.5) === s.late).length / scored.length;
    const late = scored.filter((s) => s.late);
    const onTime = scored.filter((s) => !s.late);
    let wins = 0;
    for (const a of late) for (const b of onTime) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;
    return { accuracy, auc: wins / (late.length * onTime.length), lateShare: late.length / scored.length };
};

const loadModel = () => JSON.parse(fs.readFileSync(MODEL_FILE, 'utf8'));

module.exports = { MODEL_FILE, DEPOT, FEATURES, haversineKm, train, predict, evaluate, loadModel };
