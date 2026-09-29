-- Adds the storage tariff (free days and daily rate per container type) to an existing database (safe to run more than once).
-- A fresh install does NOT need this file: init.sql already has it.
-- Run it from the backend folder:
--   node scripts/run_sql.js ../database/upgrades/upgrade_add_billing.sql
USE swot_db;
GO

IF OBJECT_ID('storage_rate', 'U') IS NULL
BEGIN
    CREATE TABLE storage_rate (
        container_type VARCHAR(4) NOT NULL PRIMARY KEY,
        free_days INT NOT NULL CHECK (free_days BETWEEN 0 AND 60),
        daily_rate INT NOT NULL CHECK (daily_rate BETWEEN 0 AND 1000000),
        CONSTRAINT fk_storage_rate_type CHECK (container_type IN ('20DV', '40DV', '40HC', '20RF', '40RF'))
    );
    INSERT INTO storage_rate (container_type, free_days, daily_rate) VALUES
    ('20DV', 5, 12000), ('40DV', 5, 20000), ('40HC', 5, 22000), ('20RF', 3, 35000), ('40RF', 3, 55000);
END
GO
