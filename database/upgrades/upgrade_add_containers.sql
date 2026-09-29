-- Adds the container storage service to an existing database (safe to run more than once):
-- the yard operator role and user, the container and container_event tables and some demo containers.
-- A fresh install does NOT need this file: init.sql already has all of it.
-- Run it from the backend folder, then load the procedures:
--   node scripts/run_sql.js ../database/upgrades/upgrade_add_containers.sql ../database/procedures.sql
USE swot_db;
GO

-- 1. New role: yard
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_app_user_role')
    ALTER TABLE app_user DROP CONSTRAINT ck_app_user_role;
GO
ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN ('dispatcher', 'driver', 'admin', 'supervisor', 'yard'));
GO
IF NOT EXISTS (SELECT 1 FROM app_user WHERE email = 'patio@swot.cl')
    INSERT INTO app_user (name, email, password_hash, role) VALUES
    ('Operador de Patio', 'patio@swot.cl', '$2b$10$in5zTSAbMxTHDsQRhGmGHeivVrONc/GFO1utYKvmmIzosFfuDZt3W', 'yard');
GO

-- 2. Tables
IF OBJECT_ID('container', 'U') IS NULL
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
GO
IF OBJECT_ID('container_event', 'U') IS NULL
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

-- 3. Demo containers (only when the table is empty)
IF NOT EXISTS (SELECT 1 FROM container)
BEGIN
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

END
GO
