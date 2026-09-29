// End-to-end API test. It starts its own server on port 3998 against the database in .env,
// runs the whole business flow with the four roles, and deletes everything it created.
// Run it from the backend folder with:  npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { sql, poolPromise } = require('../src/config/db');
const { normalizeContainerNumber } = require('../src/utils/validate');

const BASE = 'http://localhost:3998/api';
const PASSWORD = 'hash_simulado_123';
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const created = { orders: [], products: [], drivers: [], customers: [], vehicles: [], containers: [] };
const tokens = {};
let server;
let serverOutput = ''; // everything the server prints (the recovery mail goes there when no SMTP is set)

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
    server.stdout.on('data', (d) => { serverOutput += d.toString(); });
    await new Promise((resolve) => server.stdout.on('data', (d) => d.toString().includes('API corriendo') && resolve()));

    tokens.dispatcher = await login('despachador@swot.cl');
    tokens.driver = await login('conductor@swot.cl');
    tokens.admin = await login('admin@swot.cl');
    tokens.supervisor = await login('supervisor@swot.cl');
    tokens.yard = await login('patio@swot.cl');
});

after(async () => {
    server.kill();
    const pool = await poolPromise;
    const run = (query) => pool.request().query(query);
    for (const id of created.orders) {
        await run(`DELETE FROM order_item WHERE order_id = ${id}; DELETE FROM order_history WHERE order_id = ${id}; DELETE FROM transport_order WHERE id = ${id}`);
    }
    for (const id of created.containers) await run(`DELETE FROM container_event WHERE container_id = ${id}; DELETE FROM container WHERE id = ${id}`);
    for (const id of created.products) await run(`DELETE FROM product WHERE id = ${id}`);
    for (const id of created.drivers) await run(`DELETE FROM password_reset WHERE user_id = ${id}; DELETE FROM truck_position WHERE driver_id = ${id}`);
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

test('OTIF by month and for the whole history, alerts and exports', async () => {
    const otif = await call('GET', '/otif?groupBy=month', { token: tokens.supervisor });
    assert.equal(otif.status, 200);
    assert.ok(otif.body.total >= 1 && otif.body.otif >= 1);
    assert.ok(otif.body.series.length >= 1);
    assert.equal((await call('GET', '/otif?groupBy=all', { token: tokens.admin })).status, 200);
    assert.equal((await call('GET', '/otif?groupBy=week', { token: tokens.admin })).status, 400);

    // Filters by customer, driver and month: they narrow the numbers, and bad ids are rejected
    const all = (await call('GET', '/otif?groupBy=all', { token: tokens.admin })).body;
    const oneCustomer = (await call('GET', '/otif?groupBy=all&customerId=1', { token: tokens.admin })).body;
    assert.ok(oneCustomer.total >= 1 && oneCustomer.total <= all.total);
    const oneDriver = (await call('GET', '/otif?groupBy=all&driverId=2', { token: tokens.admin })).body;
    assert.ok(oneDriver.total >= 1 && oneDriver.total <= all.total);
    assert.equal((await call('GET', '/otif?groupBy=all&customerId=999999', { token: tokens.admin })).body.total, 0);
    assert.equal((await call('GET', '/otif?customerId=abc', { token: tokens.admin })).status, 400);
    assert.equal((await call('GET', '/otif?driverId=-3', { token: tokens.admin })).status, 400);
    const month = (await call('GET', '/otif?groupBy=all&from=2026-05-01&to=2026-05-31', { token: tokens.admin })).body;
    assert.ok(month.total <= all.total);

    const alerts = await call('GET', '/alerts', { token: tokens.dispatcher });
    assert.equal(alerts.status, 200);
    assert.ok(alerts.body.vehicles.some((v) => v.plate === 'ZZ9999')); // inspection expires in 10 days

    const excel = await call('GET', '/orders/export/excel?status=Delivered', { token: tokens.supervisor });
    assert.equal(excel.status, 200);
    assert.match(excel.type, /spreadsheetml/);
    const pdf = await call('GET', '/orders/export/pdf', { token: tokens.supervisor });
    assert.match(pdf.type, /application\/pdf/);
    assert.equal(Buffer.from(pdf.body).subarray(0, 4).toString(), '%PDF');
    const otifPdf = await call('GET', '/otif/export/pdf?groupBy=all', { token: tokens.supervisor });
    assert.match(otifPdf.type, /application\/pdf/);
});

// A random ISO 6346 number: fixed test prefix, random serial, and the one check digit that makes it valid
const newContainerNumber = () => {
    const base = `ZZZU${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
    return [...Array(10).keys()].map((d) => base + d).find((candidate) => normalizeContainerNumber(candidate));
};

test('containers: permissions and validation', async () => {
    assert.equal((await call('GET', '/containers', { token: tokens.yard })).status, 200);
    assert.equal((await call('GET', '/containers', { token: tokens.supervisor })).status, 200);
    assert.equal((await call('GET', '/containers', { token: tokens.dispatcher })).status, 403);
    assert.equal((await call('GET', '/containers', { token: tokens.driver })).status, 403);
    assert.equal((await call('GET', '/customers', { token: tokens.yard })).status, 200); // needed to register containers

    const dry = { containerNumber: newContainerNumber(), customerId: 1, containerType: '40HC', cargoType: 'dry' };
    assert.equal((await call('POST', '/containers', { token: tokens.supervisor, body: dry })).status, 403); // read only
    assert.equal((await call('POST', '/containers', { token: tokens.yard, body: { ...dry, containerNumber: 'CSQU3054384' } })).status, 400); // bad check digit
    assert.equal((await call('POST', '/containers', { token: tokens.yard, body: { ...dry, containerType: '10XX' } })).status, 400);
    assert.equal((await call('POST', '/containers', { token: tokens.yard, body: { ...dry, cargoType: 'perishable', temperatureC: 4 } })).status, 400); // perishable needs a reefer
    assert.equal((await call('POST', '/containers', { token: tokens.yard, body: { ...dry, containerType: '40RF', cargoType: 'perishable' } })).status, 400); // and a temperature
    assert.equal((await call('POST', '/containers', { token: tokens.yard, body: { ...dry, customerId: 999999 } })).status, 409);
    const evil = encodeURIComponent("InYard';DROP TABLE container;--");
    assert.equal((await call('GET', `/containers?status=${evil}`, { token: tokens.yard })).status, 400);
});

test('containers: announce, arrive, move and depart with history', async () => {
    const body = {
        containerNumber: newContainerNumber(), customerId: 1, containerType: '40RF', cargoType: 'perishable',
        temperatureC: 2, sealNumber: 'SL-TEST', expectedArrival: futureDay(1), plannedDeparture: futureDay(4),
    };
    const made = await call('POST', '/containers', { token: tokens.yard, body });
    assert.equal(made.status, 201);
    const id = made.body.id;
    created.containers.push(id);
    assert.equal((await call('POST', '/containers', { token: tokens.admin, body })).status, 409); // same number

    const event = (kind, payload = {}, token = tokens.yard) => call('POST', `/containers/${id}/${kind}`, { token, body: payload });
    assert.equal((await event('move', { yardLocation: 'B-01-1' })).status, 409); // has not arrived
    assert.equal((await event('depart')).status, 409);
    assert.equal((await event('arrive', {})).status, 400); // needs a yard position
    assert.equal((await event('arrive', { yardLocation: 'B-01-1' }, tokens.supervisor)).status, 403);
    assert.equal((await event('arrive', { yardLocation: 'r-01-1' })).status, 200);
    assert.equal((await event('arrive', { yardLocation: 'R-01-1' })).status, 409); // already in the yard
    assert.equal((await event('move', { yardLocation: 'R-01-1' })).status, 409); // same position
    assert.equal((await event('move', { yardLocation: 'R-02-4', notes: 'closer to the plug' })).status, 200);

    const inYard = (await call('GET', `/containers/${id}`, { token: tokens.supervisor })).body.container;
    assert.equal(inYard.status, 'InYard');
    assert.equal(inYard.yardLocation, 'R-02-4');
    assert.equal(inYard.daysInYard, 0);
    assert.equal(inYard.overstay, 0);

    assert.equal((await call('PUT', `/containers/${id}`, { token: tokens.admin, body: { ...body, plannedDeparture: futureDay(6), notes: 'edited' } })).status, 200);
    assert.equal((await event('depart', { notes: 'picked up by the customer' })).status, 200);
    assert.equal((await event('depart')).status, 409);
    assert.equal((await call('PUT', `/containers/${id}`, { token: tokens.admin, body })).status, 409); // departed containers are closed

    const detail = (await call('GET', `/containers/${id}`, { token: tokens.admin })).body;
    assert.deepEqual(detail.events.map((e) => e.eventType), ['Announced', 'Arrived', 'Moved', 'Departed']);
    assert.equal(detail.container.status, 'Departed');
    assert.equal(detail.container.yardLocation, null);
    assert.equal(detail.events[3].yardLocation, 'R-02-4'); // the history keeps the last position
});

test('containers: summary and alerts by service', async () => {
    const summary = await call('GET', '/containers/summary', { token: tokens.yard });
    assert.equal(summary.status, 200);
    for (const key of ['expected', 'inYard', 'departed', 'perishableInYard', 'dryInYard', 'overstays', 'avgDaysInYard', 'freeDays']) {
        assert.ok(key in summary.body, `summary has ${key}`);
    }

    const yardAlerts = (await call('GET', '/alerts', { token: tokens.yard })).body;
    assert.deepEqual([yardAlerts.vehicles.length, yardAlerts.overdueOrders.length], [0, 0]); // storage alerts only
    const dispatcherAlerts = (await call('GET', '/alerts', { token: tokens.dispatcher })).body;
    assert.deepEqual([dispatcherAlerts.overstayContainers.length, dispatcherAlerts.overdueContainers.length], [0, 0]); // transport alerts only
    assert.equal((await call('GET', '/alerts', { token: tokens.driver })).status, 403);
});

test('maps: customer points, the driver reports the truck and the supervisor sees the fleet', async () => {
    // Customer delivery point: both coordinates or none, inside the valid ranges
    const customer = { name: 'ZZ Map Customer', taxId: '22.222.222-2', address: 'Map street 1' };
    assert.equal((await call('POST', '/customers', { token: tokens.admin, body: { ...customer, latitude: -33.05 } })).status, 400);
    assert.equal((await call('POST', '/customers', { token: tokens.admin, body: { ...customer, latitude: 200, longitude: -71.5 } })).status, 400);
    const made = await call('POST', '/customers', { token: tokens.admin, body: { ...customer, latitude: -33.05, longitude: -71.55 } });
    assert.equal(made.status, 201);
    created.customers.push(made.body.id);
    const listed = (await call('GET', '/customers?search=ZZ%20Map', { token: tokens.admin })).body[0];
    assert.deepEqual([listed.latitude, listed.longitude], [-33.05, -71.55]);

    // A brand new driver, so the real drivers' positions are never touched
    const driver = { name: 'ZZ Map Driver', email: 'zz.map.driver@swot.cl', password: 'abcd1234' };
    const driverMade = await call('POST', '/drivers', { token: tokens.admin, body: driver });
    created.drivers.push(driverMade.body.id);
    const driverToken = (await call('POST', '/auth/login', { body: { email: driver.email, password: driver.password } })).body.token;

    const order = await call('POST', '/orders', { token: tokens.dispatcher, body: { customerId: made.body.id, weightKg: 10 } });
    created.orders.push(order.body.id);
    await call('PATCH', `/orders/${order.body.id}/schedule`, { token: tokens.dispatcher, body: { vehicleId: 1, driverId: driverMade.body.id } });

    // The route carries the delivery point of each order
    const route = (await call('GET', '/my-route', { token: driverToken })).body;
    assert.deepEqual([route[0].customerLatitude, route[0].customerLongitude], [-33.05, -71.55]);

    const position = { latitude: -33.02, longitude: -71.5 };
    assert.equal((await call('POST', '/my-route/position', { token: driverToken, body: position })).status, 409); // nothing in transit yet
    await call('PATCH', `/orders/${order.body.id}/status`, { token: driverToken, body: { status: 'InTransit' } });
    assert.equal((await call('POST', '/my-route/position', { token: driverToken, body: { latitude: 'north', longitude: 1 } })).status, 400);
    assert.equal((await call('POST', '/my-route/position', { token: driverToken, body: { latitude: 95, longitude: 1 } })).status, 400);
    assert.equal((await call('POST', '/my-route/position', { token: tokens.dispatcher, body: position })).status, 403);
    assert.equal((await call('POST', '/my-route/position', { token: driverToken, body: position })).status, 200);
    assert.equal((await call('POST', '/my-route/position', { token: driverToken, body: { latitude: -33.03, longitude: -71.52 } })).status, 200); // updates the same row

    // Who can see the fleet
    assert.equal((await call('GET', '/fleet', { token: tokens.dispatcher })).status, 403);
    assert.equal((await call('GET', '/fleet', { token: driverToken })).status, 403);
    const fleet = (await call('GET', '/fleet', { token: tokens.supervisor })).body;
    const truck = fleet.find((t) => t.orderId === order.body.id);
    assert.equal(truck.driverName, 'ZZ Map Driver');
    assert.deepEqual([truck.position.latitude, truck.position.longitude], [-33.03, -71.52]);
    assert.ok(truck.position.secondsAgo >= 0 && truck.position.secondsAgo < 60);
    assert.deepEqual([truck.destination.latitude, truck.destination.longitude], [-33.05, -71.55]);
    assert.equal((await call('GET', '/fleet', { token: tokens.admin })).status, 200);

    // Delivering ends the tracking: the truck leaves the map and its position is deleted
    const delivered = await call('PATCH', `/orders/${order.body.id}/status`, { token: driverToken, body: { status: 'Delivered', receiverTaxId: '11.111.111-1', deliveryPhoto: TINY_PNG } });
    assert.equal(delivered.status, 200);
    assert.equal((await call('GET', '/fleet', { token: tokens.supervisor })).body.some((t) => t.orderId === order.body.id), false);
    const pool = await poolPromise;
    const left = await pool.request().query(`SELECT COUNT(*) AS n FROM truck_position WHERE driver_id = ${driverMade.body.id}`);
    assert.equal(left.recordset[0].n, 0);
});

// The server prints the recovery mail on its console when no SMTP is configured, so the test can read the link from there
const lastResetToken = (email) => {
    const mails = serverOutput.split('[mail]').filter((m) => m.includes(`to=${email}`));
    return mails.length ? mails[mails.length - 1].match(/reset-password\?token=([a-f0-9]{64})/)?.[1] : undefined;
};

test('password recovery: one-time link, old sessions end, no way to find out who has an account', async () => {
    const user = { name: 'ZZ Reset Driver', email: 'zz.reset.driver@swot.cl', password: 'abcd1234' };
    const made = await call('POST', '/drivers', { token: tokens.admin, body: user });
    created.drivers.push(made.body.id);
    const oldToken = (await call('POST', '/auth/login', { body: { email: user.email, password: user.password } })).body.token;
    assert.equal((await call('GET', '/my-route', { token: oldToken })).status, 200);

    // The same answer for a registered and an unknown email; a bad email is rejected
    const known = await call('POST', '/auth/forgot-password', { body: { email: user.email } });
    const unknown = await call('POST', '/auth/forgot-password', { body: { email: 'nobody.here@swot.cl' } });
    assert.equal(known.status, 200);
    assert.deepEqual(unknown.body, known.body);
    assert.equal((await call('POST', '/auth/forgot-password', { body: { email: 'not-an-email' } })).status, 400);
    await new Promise((resolve) => setTimeout(resolve, 300)); // the mail is sent after the answer
    assert.equal(lastResetToken('nobody.here@swot.cl'), undefined);
    const link = lastResetToken(user.email);
    assert.match(link, /^[a-f0-9]{64}$/);

    // Bad links and bad passwords are rejected
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: 'f'.repeat(64), password: 'newpass123' } })).status, 400);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: 'short', password: 'newpass123' } })).status, 400);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: link, password: '123' } })).status, 400);

    // Token times are in whole seconds: wait one so the session opened above is clearly older than the change
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // The link works once
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: link, password: 'newpass123' } })).status, 200);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: link, password: 'another123' } })).status, 400);

    // The old password no longer works, the new one does, and the session opened before the change is over
    assert.equal((await call('POST', '/auth/login', { body: { email: user.email, password: user.password } })).status, 401);
    const fresh = await call('POST', '/auth/login', { body: { email: user.email, password: 'newpass123' } });
    assert.equal(fresh.status, 200);
    assert.equal((await call('GET', '/my-route', { token: oldToken })).status, 401);
    assert.equal((await call('GET', '/my-route', { token: fresh.body.token })).status, 200);

    // Asking again cancels the previous link
    await call('POST', '/auth/forgot-password', { body: { email: user.email } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const first = lastResetToken(user.email);
    await call('POST', '/auth/forgot-password', { body: { email: user.email } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const second = lastResetToken(user.email);
    assert.notEqual(first, second);
    assert.equal((await call('POST', '/auth/reset-password', { body: { token: first, password: 'stale12345' } })).status, 400);
});
