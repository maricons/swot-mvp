-- SWOT: full schema and test data for a fresh install.
-- Create the database first (CREATE DATABASE swot_db;), then run this file and procedures.sql.
-- An existing database with the old Spanish tables uses upgrade_to_english.sql instead.
USE swot_db;
GO

-- 1. Users. Roles: dispatcher, driver, admin, supervisor
CREATE TABLE app_user (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT df_app_user_IsActive DEFAULT 1,
    CONSTRAINT ck_app_user_role CHECK (role IN ('dispatcher', 'driver', 'admin', 'supervisor'))
);

-- 2. Customers (companies). tax_id is the Chilean RUT
CREATE TABLE customer (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    tax_id VARCHAR(20) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT df_customer_IsActive DEFAULT 1
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
GO

-- TEST DATA (every user's password is hash_simulado_123, stored with bcrypt)
INSERT INTO app_user (name, email, password_hash, role) VALUES
('Admin Despachos', 'despachador@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'dispatcher'),
('Juan Conductor', 'conductor@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'driver'),
('Administrador SWOT', 'admin@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'admin'),
('Supervisor SWOT', 'supervisor@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'supervisor'),
('Pedro Conductor', 'driver2@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'driver');

INSERT INTO customer (name, address, tax_id) VALUES
('Empresa Alpha', 'Av. Siempre Viva 742', '76.123.456-0'),
('Comercial Beta', 'Calle Falsa 123', '77.987.654-3');

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
GO
