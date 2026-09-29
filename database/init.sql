-- SWOT: full schema and test data for a fresh install.
-- Create the database first (CREATE DATABASE swot_db;), then run this file and procedures.sql.
-- An existing database with the old Spanish tables uses upgrades/upgrade_to_english.sql instead.
USE swot_db;
GO

-- 1. Users. Roles: dispatcher, driver, admin, supervisor, yard (container yard operator)
CREATE TABLE app_user (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT df_app_user_IsActive DEFAULT 1,
    password_changed_at DATETIME NULL,   -- sessions started before this moment are no longer valid
    CONSTRAINT ck_app_user_role CHECK (role IN ('dispatcher', 'driver', 'admin', 'supervisor', 'yard'))
);

-- Password recovery: one row per link sent by email. Only the SHA-256 hash of the token is stored,
-- so a leaked database cannot be used to reset anyone's password. Each link works once and expires.
CREATE TABLE password_reset (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL FOREIGN KEY REFERENCES app_user(id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE()
);

-- 2. Customers (companies). tax_id is the Chilean RUT
CREATE TABLE customer (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    tax_id VARCHAR(20) NOT NULL,
    latitude DECIMAL(9,6) NULL,    -- delivery point on the map (both or none)
    longitude DECIMAL(9,6) NULL,
    IsActive BIT NOT NULL CONSTRAINT df_customer_IsActive DEFAULT 1,
    CONSTRAINT ck_customer_point CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);

-- 3. Vehicles. inspection_expiry is the expiry of the "revisión técnica"
CREATE TABLE vehicle (
    id INT IDENTITY(1,1) PRIMARY KEY,
    plate VARCHAR(10) UNIQUE NOT NULL,
    capacity_kg DECIMAL(10,2) NOT NULL,
    inspection_expiry DATE NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT df_vehicle_IsActive DEFAULT 1
);

-- 4. Products. content_* only describes the product (500 mg, 20 L); weight_kg is the real weight of one package
CREATE TABLE product (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'unit',
    content_amount DECIMAL(12,3) NULL,
    content_unit VARCHAR(5) NULL,
    weight_kg DECIMAL(12,3) NULL,
    photo VARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CONSTRAINT ck_product_content CHECK (
        (content_amount IS NULL AND content_unit IS NULL)
        OR (content_amount > 0 AND content_unit IN ('mg', 'g', 'kg', 'ml', 'L'))
    ),
    CONSTRAINT ck_product_weight CHECK (weight_kg IS NULL OR weight_kg > 0)
);

-- 5. Transport orders. Flow: Created -> Scheduled -> InTransit -> Delivered or Failed
CREATE TABLE transport_order (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL FOREIGN KEY REFERENCES customer(id),
    vehicle_id INT NULL FOREIGN KEY REFERENCES vehicle(id),
    driver_id INT NULL FOREIGN KEY REFERENCES app_user(id),
    status VARCHAR(20) NOT NULL CONSTRAINT df_transport_order_status DEFAULT 'Created',
    weight_kg DECIMAL(10,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    due_date DATE NULL,             -- promised delivery date (OTIF)
    delivered_at DATETIME NULL,     -- when it was delivered (OTIF)
    in_full BIT NULL,               -- delivered complete? (OTIF)
    receiver_tax_id VARCHAR(20) NULL,   -- RUT of whoever received the cargo
    delivery_photo VARCHAR(MAX) NULL,   -- photo of the signed delivery guide
    CONSTRAINT ck_transport_order_status CHECK (status IN ('Created', 'Scheduled', 'InTransit', 'Delivered', 'Failed'))
);

-- 6. Products carried by each order
CREATE TABLE order_item (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL FOREIGN KEY REFERENCES transport_order(id),
    product_id INT NOT NULL FOREIGN KEY REFERENCES product(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

-- 7. Status history of each order
CREATE TABLE order_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL FOREIGN KEY REFERENCES transport_order(id),
    previous_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_at DATETIME NOT NULL DEFAULT GETDATE(),
    user_id INT NULL FOREIGN KEY REFERENCES app_user(id)
);

-- 8. Last known position of each driver's truck while an order is in transit (one row per driver).
-- The driver's phone reports it; the row is deleted when the driver has no order in transit.
CREATE TABLE truck_position (
    driver_id INT NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES app_user(id),
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    recorded_at DATETIME NOT NULL DEFAULT GETDATE()
);

-- 9. Container storage service (a second service next to transport).
-- container_number follows ISO 6346 (4 letters + 6 digits + check digit).
-- Flow: Expected -> InYard (arrival) -> Departed. Perishable cargo travels in a reefer and has a set temperature.
CREATE TABLE container (
    id INT IDENTITY(1,1) PRIMARY KEY,
    container_number VARCHAR(11) NOT NULL UNIQUE,
    customer_id INT NOT NULL FOREIGN KEY REFERENCES customer(id),
    container_type VARCHAR(4) NOT NULL,
    cargo_type VARCHAR(10) NOT NULL,
    temperature_c DECIMAL(4,1) NULL,
    seal_number VARCHAR(20) NULL,
    status VARCHAR(10) NOT NULL CONSTRAINT df_container_status DEFAULT 'Expected',
    yard_location VARCHAR(20) NULL,
    expected_arrival DATE NULL,
    arrived_at DATETIME NULL,
    planned_departure DATE NULL,
    departed_at DATETIME NULL,
    notes VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT ck_container_type CHECK (container_type IN ('20DV', '40DV', '40HC', '20RF', '40RF')),
    CONSTRAINT ck_container_cargo CHECK (cargo_type IN ('dry', 'perishable')),
    CONSTRAINT ck_container_status CHECK (status IN ('Expected', 'InYard', 'Departed')),
    CONSTRAINT ck_container_perishable CHECK (cargo_type = 'dry' OR (container_type IN ('20RF', '40RF') AND temperature_c IS NOT NULL))
);

-- 10. Everything that happens to a container (announced, arrived, moved, departed)
CREATE TABLE container_event (
    id INT IDENTITY(1,1) PRIMARY KEY,
    container_id INT NOT NULL FOREIGN KEY REFERENCES container(id),
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('Announced', 'Arrived', 'Moved', 'Departed')),
    event_at DATETIME NOT NULL DEFAULT GETDATE(),
    yard_location VARCHAR(20) NULL,
    notes VARCHAR(255) NULL,
    user_id INT NULL FOREIGN KEY REFERENCES app_user(id)
);
GO

-- 11. Storage tariff per container type: days included for free, then a daily rate (CLP) for every extra day in the yard
CREATE TABLE storage_rate (
    container_type VARCHAR(4) NOT NULL PRIMARY KEY,
    free_days INT NOT NULL CHECK (free_days BETWEEN 0 AND 60),
    daily_rate INT NOT NULL CHECK (daily_rate BETWEEN 0 AND 1000000),
    CONSTRAINT fk_storage_rate_type CHECK (container_type IN ('20DV', '40DV', '40HC', '20RF', '40RF'))
);
INSERT INTO storage_rate (container_type, free_days, daily_rate) VALUES
('20DV', 5, 12000), ('40DV', 5, 20000), ('40HC', 5, 22000), ('20RF', 3, 35000), ('40RF', 3, 55000);
GO

-- TEST DATA (every user's password is hash_simulado_123, stored with bcrypt)
INSERT INTO app_user (name, email, password_hash, role) VALUES
('Admin Despachos', 'despachador@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'dispatcher'),
('Juan Conductor', 'conductor@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'driver'),
('Administrador SWOT', 'admin@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'admin'),
('Supervisor SWOT', 'supervisor@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'supervisor'),
('Pedro Conductor', 'driver2@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'driver'),
('Operador de Patio', 'patio@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'yard');

INSERT INTO customer (name, address, tax_id, latitude, longitude) VALUES
('Empresa Alpha', 'Av. Siempre Viva 742', '76.123.456-0', -33.045800, -71.619700),
('Comercial Beta', 'Calle Falsa 123', '77.987.654-3', -33.437200, -70.650600);

-- The second vehicle has an expired inspection, useful to test the scheduling rules and the alerts
INSERT INTO vehicle (plate, capacity_kg, inspection_expiry) VALUES
('AB1234', 5000.00, '2027-12-31'),
('CD5678', 3000.00, '2023-01-01');

INSERT INTO product (name, unit, content_amount, content_unit, weight_kg) VALUES
('Hammer drill', 'unit', NULL, NULL, NULL),
('Paint bucket', 'unit', 20, 'L', NULL),
('Paracetamol', 'box', 500, 'mg', NULL),
('Cement bag', 'bag', 25, 'kg', 25);

INSERT INTO transport_order (customer_id, weight_kg) VALUES
(1, 1500.50),
(2, 450.00);
-- Demo containers: one overstaying in the yard, one perishable reefer, one expected, one already departed
INSERT INTO container (container_number, customer_id, container_type, cargo_type, temperature_c, seal_number, status, yard_location, expected_arrival, arrived_at, planned_departure, departed_at, notes) VALUES
('MSCU1234566', 1, '40HC', 'dry', NULL, 'SL-100234', 'InYard', 'A-03-2', DATEADD(DAY, -8, CAST(GETDATE() AS DATE)), DATEADD(DAY, -8, GETDATE()), DATEADD(DAY, -2, CAST(GETDATE() AS DATE)), NULL, 'Ferretería: herramientas'),
('TGHU6543213', 2, '40RF', 'perishable', 2.0, 'SL-100871', 'InYard', 'R-01-1', DATEADD(DAY, -1, CAST(GETDATE() AS DATE)), DATEADD(DAY, -1, GETDATE()), DATEADD(DAY, 3, CAST(GETDATE() AS DATE)), NULL, 'Fruta fresca, cadena de frío'),
('CMAU2468103', 1, '20DV', 'dry', NULL, NULL, 'Expected', NULL, DATEADD(DAY, 2, CAST(GETDATE() AS DATE)), NULL, DATEADD(DAY, 6, CAST(GETDATE() AS DATE)), NULL, NULL),
('HLXU1357910', 2, '20DV', 'dry', NULL, 'SL-099120', 'Departed', NULL, DATEADD(DAY, -10, CAST(GETDATE() AS DATE)), DATEADD(DAY, -10, GETDATE()), DATEADD(DAY, -4, CAST(GETDATE() AS DATE)), DATEADD(DAY, -4, GETDATE()), NULL);

INSERT INTO container_event (container_id, event_type, event_at, yard_location, user_id)
SELECT c.id, 'Announced', c.created_at, NULL, NULL FROM container c;
INSERT INTO container_event (container_id, event_type, event_at, yard_location, user_id)
SELECT c.id, 'Arrived', c.arrived_at, c.yard_location, NULL FROM container c WHERE c.arrived_at IS NOT NULL;
INSERT INTO container_event (container_id, event_type, event_at, yard_location, user_id)
SELECT c.id, 'Departed', c.departed_at, 'A-03-1', NULL FROM container c WHERE c.departed_at IS NOT NULL;
GO
