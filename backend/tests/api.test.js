// End-to-end API test. It starts its own server on port 3998 against the database in .env,
// runs the whole business flow with the four roles, and deletes everything it created.
// Run it from the backend folder with:  npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { sql, poolPromise } = require('../src/config/db');

const BASE = 'http://localhost:3998/api';
const PASSWORD = 'hash_simulado_123';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const created = { orders: [], products: [], drivers: [], customers: [], vehicles: [] };
const tokens = {};
let server;

// Sends a request and returns { status, body } (body is parsed JSON, or the raw type for files)
const call = async (method, path, { token, body } = {}) => {
    const response = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
    });
    const type = response.headers.get('content-type') || '';
    return { status: response.status, type, body: type.includes('json') ? await response.json() : await response.arrayBuffer() };
};

const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: PASSWORD } })).body.token;
const futureDay = (days) => new Date(Date.now() + days * 864e5).toLocaleDateString('en-CA');

before(async () => {
    server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3998' }, stdio: ['ignore', 'pipe', 'inherit'] });
    await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('API corriendo') && resolve()));

    tokens.dispatcher = await login('despachador@swot.cl');
    tokens.driver = await login('conductor@swot.cl');
    tokens.admin = await login('admin@swot.cl');
    tokens.supervisor = await login('supervisor@swot.cl');
});

after(async () => {
    server.kill();
    const pool = await poolPromise;
    const run = (query) => pool.request().query(query);
    for (const id of created.orders) {
        await run(`DELETE FROM order_item WHERE order_id = ${id}; DELETE FROM order_history WHERE order_id = ${id}; DELETE FROM transport_order WHERE id = ${id}`);
    }
    for (const id of created.products) await run(`DELETE FROM product WHERE id = ${id}`);
    for (const id of created.drivers) await run(`DELETE FROM app_user WHERE id = ${id}`);
    for (const id of created.customers) await run(`DELETE FROM customer WHERE id = ${id}`);
    for (const id of created.vehicles) await run(`DELETE FROM vehicle WHERE id = ${id}`);
    await pool.close();
});

test('login rejects wrong credentials and protects routes', async () => {
    assert.equal((await call('POST', '/auth/login', { body: { email: 'admin@swot.cl', password: 'wrong' } })).status, 401);
    assert.equal((await call('GET', '/orders')).status, 401);
    assert.equal((await call('GET', '/orders', { token: 'garbage' })).status, 401);
});

test('roles: who can read and who can write', async () => {
    assert.equal((await call('GET', '/orders', { token: tokens.supervisor })).status, 200);
    assert.equal((await call('GET', '/orders', { token: tokens.driver })).status, 403);
    assert.equal((await call('POST', '/orders', { token: tokens.supervisor, body: { customerId: 1, weightKg: 10 } })).status, 403);
    assert.equal((await call('POST', '/customers', { token: tokens.supervisor, body: {} })).status, 403);
    assert.equal((await call('GET', '/my-route', { token: tokens.dispatcher })).status, 403);
    assert.equal((await call('GET', '/otif', { token: tokens.dispatcher })).status, 403);
});

test('SQL injection attempts are rejected before reaching the database', async () => {
    const evil = encodeURIComponent("Created';DROP TABLE app_user;--");
    assert.equal((await call('GET', `/orders?status=${evil}`, { token: tokens.admin })).status, 400);
    assert.equal((await call('POST', '/auth/login', { body: { email: "' OR 1=1 --", password: 'x' } })).status, 401);
    assert.equal((await call('GET', '/customers', { token: tokens.admin })).status, 200); // table still there
});

test('customers: RUT validation, duplicates and soft delete', async () => {
    const good = { name: 'ZZ Test Customer', taxId: '11.111.111-1', address: 'Test street 1' };
    assert.equal((await call('POST', '/customers', { token: tokens.admin, body: { ...good, taxId: '11.111.111-2' } })).status, 400);
    const made = await call('POST', '/customers', { token: tokens.admin, body: good });
    assert.equal(made.status, 201);
    created.customers.push(made.body.id);
    assert.equal((await call('POST', '/customers', { token: tokens.admin, body: good })).status, 409);
    assert.equal((await call('PATCH', `/customers/${made.body.id}/active`, { token: tokens.admin, body: { isActive: false } })).status, 200);
    const order = await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: made.body.id, weightKg: 10 } });
    assert.equal(order.status, 409); // a deactivated customer cannot receive orders
});

test('vehicles: plate validation', async () => {
    assert.equal((await call('POST', '/vehicles', { token: tokens.admin, body: { plate: 'BAD', capacityKg: 1000, inspectionExpiry: futureDay(90) } })).status, 400);
    const made = await call('POST', '/vehicles', { token: tokens.admin, body: { plate: 'zz-9999', capacityKg: 1000, inspectionExpiry: futureDay(10) } });
    assert.equal(made.status, 201);
    created.vehicles.push(made.body.id);
    const list = await call('GET', '/vehicles?search=ZZ9999', { token: tokens.supervisor });
    assert.equal(list.body[0].plate, 'ZZ9999');
});

test('drivers: creation, duplicate email and deactivation revokes access', async () => {
    const body = { name: 'ZZ Test Driver', email: 'zz.test.driver@swot.cl', password: 'abcd1234' };
    assert.equal((await call('POST', '/drivers', { token: tokens.admin, body: { ...body, password: '123' } })).status, 400);
    const made = await call('POST', '/drivers', { token: tokens.admin, body });
    assert.equal(made.status, 201);
    created.drivers.push(made.body.id);
    assert.equal((await call('POST', '/drivers', { token: tokens.admin, body })).status, 409);

    const driverToken = (await call('POST', '/auth/login', { body: { email: body.email, password: body.password } })).body.token;
    assert.equal((await call('GET', '/my-route', { token: driverToken })).status, 200);
    await call('PATCH', `/drivers/${made.body.id}/active`, { token: tokens.admin, body: { isActive: false } });
    assert.equal((await call('POST', '/auth/login', { body: { email: body.email, password: body.password } })).status, 403);
    assert.equal((await call('GET', '/my-route', { token: driverToken })).status, 401);
});

let weighted, unweighted;

test('products: photo, content is not the weight, invalid data', async () => {
    const pills = { name: 'ZZ Pills', unit: 'box', contentAmount: 500, contentUnit: 'mg', weightKg: 0.2, photo: TINY_PNG };
    assert.equal((await call('POST', '/products', { token: tokens.admin, body: { ...pills, contentUnit: undefined } })).status, 400);
    assert.equal((await call('POST', '/products', { token: tokens.admin, body: { ...pills, photo: 'data:text/html;base64,AAAA' } })).status, 400);
    weighted = await call('POST', '/products', { token: tokens.admin, body: pills });
    unweighted = await call('POST', '/products', { token: tokens.admin, body: { name: 'ZZ NoWeight', unit: 'box' } });
    assert.equal(weighted.status, 201);
    created.products.push(weighted.body.id, unweighted.body.id);
    const list = await call('GET', '/products?search=ZZ', { token: tokens.dispatcher });
    assert.equal(list.body.find((p) => p.name === 'ZZ Pills').photo, TINY_PNG);
});

let orderId;

test('orders: weight is calculated from the products, never typed', async () => {
    const dueDate = futureDay(3);
    const items = [{ productId: weighted.body.id, quantity: 10 }];
    const made = await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: 1, weightKg: 999, dueDate, items } });
    assert.equal(made.status, 201);
    orderId = made.body.id;
    created.orders.push(orderId);
    const detail = await call('GET', `/orders/${orderId}`, { token: tokens.dispatcher });
    assert.equal(detail.body.order.weightKg, 2); // 10 x 0.2 kg, not the typed 999 and not 5000 mg
    assert.equal(detail.body.items.length, 1);

    // A product without weight needs the total by hand
    const mixed = [{ productId: unweighted.body.id, quantity: 1 }];
    assert.equal((await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: 1, items: mixed } })).status, 400);
    const manual = await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: 1, weightKg: 40, items: mixed } });
    assert.equal(manual.status, 201);
    created.orders.push(manual.body.id);
    assert.equal((await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: 1, weightKg: 5, dueDate: '2020-01-01' } })).status, 400);
});

test('scheduling rules: capacity, expired inspection, inactive driver', async () => {
    const big = await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: 1, weightKg: 4000 } });
    created.orders.push(big.body.id);
    const small = created.vehicles[0]; // ZZ9999, capacity 1000 kg
    assert.equal((await call('PATCH', `/orders/${big.body.id}/schedule`, { token: tokens.dispatcher, body: { vehicleId: small, driverId: 2 } })).status, 409);

    const expired = (await call('GET', '/vehicles?search=CD5678', { token: tokens.admin })).body[0];
    assert.equal((await call('PATCH', `/orders/${orderId}/schedule`, { token: tokens.dispatcher, body: { vehicleId: expired.id, driverId: 2 } })).status, 409);
    assert.equal((await call('PATCH', `/orders/${orderId}/schedule`, { token: tokens.driver, body: { vehicleId: small, driverId: 2 } })).status, 403);
});

test('delivery flow: proof of delivery is required', async () => {
    const schedule = await call('PATCH', `/orders/${orderId}/schedule`, { token: tokens.dispatcher, body: { vehicleId: created.vehicles[0], driverId: 2 } });
    assert.equal(schedule.status, 200);

    const status = (body) => call('PATCH', `/orders/${orderId}/status`, { token: tokens.driver, body });
    const proof = { receiverTaxId: '11.111.111-1', deliveryPhoto: TINY_PNG };
    assert.equal((await status({ status: 'Delivered', ...proof })).status, 409); // cannot skip InTransit
    assert.equal((await status({ status: 'InTransit' })).status, 200);
    assert.equal((await status({ status: 'Delivered', receiverTaxId: '12.345.678-9', deliveryPhoto: TINY_PNG, inFull: true })).status, 400); // bad RUT (wrong check digit)
    assert.equal((await status({ status: 'Delivered', receiverTaxId: '12.345.678-5' })).status, 400); // no photo
    assert.equal((await status({ status: 'Delivered', receiverTaxId: '11.111.111-1', deliveryPhoto: TINY_PNG, inFull: true })).status, 200);

    const detail = await call('GET', `/orders/${orderId}`, { token: tokens.supervisor });
    assert.equal(detail.body.order.status, 'Delivered');
    assert.equal(detail.body.order.receiverTaxId, '11.111.111-1');
    assert.equal(detail.body.order.deliveryPhoto, TINY_PNG);
    assert.deepEqual(detail.body.history.map((h) => h.newStatus), ['Created', 'Scheduled', 'InTransit', 'Delivered']);
    // Lists never carry the heavy photo
    const list = await call('GET', '/orders', { token: tokens.supervisor });
    assert.equal(list.body.find((o) => o.id === orderId).hasDeliveryPhoto, 1);
    assert.equal('deliveryPhoto' in list.body[0], false);
});

test('OTIF by month and week, alerts and exports', async () => {
    const otif = await call('GET', '/otif?groupBy=month', { token: tokens.supervisor });
    assert.equal(otif.status, 200);
    assert.ok(otif.body.total >= 1 && otif.body.otif >= 1);
    assert.ok(otif.body.series.length >= 1);
    assert.equal((await call('GET', '/otif?groupBy=week', { token: tokens.admin })).status, 200);
    assert.equal((await call('GET', '/otif?groupBy=year', { token: tokens.admin })).status, 400);

    const alerts = await call('GET', '/alerts', { token: tokens.dispatcher });
    assert.equal(alerts.status, 200);
    assert.ok(alerts.body.vehicles.some((v) => v.plate === 'ZZ9999')); // inspection expires in 10 days

    const excel = await call('GET', '/orders/export/excel?status=Delivered', { token: tokens.supervisor });
    assert.equal(excel.status, 200);
    assert.match(excel.type, /spreadsheetml/);
    const pdf = await call('GET', '/orders/export/pdf', { token: tokens.supervisor });
    assert.match(pdf.type, /application\/pdf/);
    assert.equal(Buffer.from(pdf.body).subarray(0, 4).toString(), '%PDF');
    const otifPdf = await call('GET', '/otif/export/pdf?groupBy=week', { token: tokens.supervisor });
    assert.match(otifPdf.type, /application\/pdf/);
});
