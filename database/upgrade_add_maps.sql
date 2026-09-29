-- Adds maps to an existing database (safe to run more than once): the delivery point of each customer
-- (latitude and longitude) and the table with the last known position of each truck.
-- A fresh install does NOT need this file: init.sql already has all of it.
-- Run it from the backend folder, then load the procedures:
--   node scripts/run_sql.js ../database/upgrade_add_maps.sql ../database/procedures.sql
USE swot_db;
GO

IF COL_LENGTH('customer', 'latitude') IS NULL
    ALTER TABLE customer ADD latitude DECIMAL(9,6) NULL, longitude DECIMAL(9,6) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_customer_point')
    ALTER TABLE customer ADD CONSTRAINT ck_customer_point
        CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180));
GO

-- Demo points for the two test customers (an admin sets the others from the customer form)
UPDATE customer SET latitude = -33.045800, longitude = -71.619700 WHERE name = 'Empresa Alpha' AND latitude IS NULL;
UPDATE customer SET latitude = -33.437200, longitude = -70.650600 WHERE name = 'Comercial Beta' AND latitude IS NULL;
GO

IF OBJECT_ID('truck_position', 'U') IS NULL
    CREATE TABLE truck_position (
        driver_id INT NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES app_user(id),
        latitude DECIMAL(9,6) NOT NULL,
        longitude DECIMAL(9,6) NOT NULL,
        recorded_at DATETIME NOT NULL DEFAULT GETDATE()
    );
GO
