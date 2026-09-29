-- Adds password recovery to an existing database (safe to run more than once):
-- the moment a password last changed (to end old sessions) and the table of reset links.
-- A fresh install does NOT need this file: init.sql already has all of it.
-- Run it from the backend folder:
--   node scripts/run_sql.js ../database/upgrades/upgrade_add_password_reset.sql
USE swot_db;
GO

IF COL_LENGTH('app_user', 'password_changed_at') IS NULL
    ALTER TABLE app_user ADD password_changed_at DATETIME NULL;
GO

IF OBJECT_ID('password_reset', 'U') IS NULL
    CREATE TABLE password_reset (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL FOREIGN KEY REFERENCES app_user(id),
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
GO
