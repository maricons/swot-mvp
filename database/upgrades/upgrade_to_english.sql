-- One-time upgrade for a database created with the old Spanish schema (usuario, cliente, ...).
-- It renames everything to English, translates the stored status and role values, and adds the
-- delivery proof columns (signed guide photo + receiver RUT). A fresh install does NOT need this
-- file: init.sql already creates the final schema.
-- Safe to run more than once. Run it from the backend folder, then load the procedures:
--   node scripts/run_sql.js ../database/upgrades/upgrade_to_english.sql ../database/procedures.sql
USE swot_db;
GO

-- 1. Drop the check constraints and the status default that still mention Spanish values
IF OBJECT_ID('usuario', 'U') IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'';
    SELECT @sql += 'ALTER TABLE ' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';'
    FROM sys.check_constraints
    WHERE parent_object_id IN (OBJECT_ID('usuario'), OBJECT_ID('orden_transporte'), OBJECT_ID('ot_historial'));

    SELECT @sql += 'ALTER TABLE orden_transporte DROP CONSTRAINT ' + QUOTENAME(dc.name) + ';'
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('orden_transporte') AND c.name = 'estado';

    EXEC (@sql);
END
GO

-- 2. Rename tables and columns
IF OBJECT_ID('usuario', 'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'usuario', 'app_user';
    EXEC sp_rename 'app_user.nombre', 'name', 'COLUMN';
    EXEC sp_rename 'app_user.rol', 'role', 'COLUMN';
END
IF OBJECT_ID('cliente', 'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'cliente', 'customer';
    EXEC sp_rename 'customer.nombre', 'name', 'COLUMN';
    EXEC sp_rename 'customer.direccion', 'address', 'COLUMN';
    EXEC sp_rename 'customer.rut', 'tax_id', 'COLUMN';
    EXEC sp_rename 'customer.activo', 'IsActive', 'COLUMN';
END
IF OBJECT_ID('vehiculo', 'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'vehiculo', 'vehicle';
    EXEC sp_rename 'vehicle.patente', 'plate', 'COLUMN';
    EXEC sp_rename 'vehicle.vencimiento_rt', 'inspection_expiry', 'COLUMN';
    EXEC sp_rename 'vehicle.activo', 'IsActive', 'COLUMN';
END
IF OBJECT_ID('orden_transporte', 'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'orden_transporte', 'transport_order';
    EXEC sp_rename 'transport_order.cliente_id', 'customer_id', 'COLUMN';
    EXEC sp_rename 'transport_order.vehiculo_id', 'vehicle_id', 'COLUMN';
    EXEC sp_rename 'transport_order.usuario_conductor_id', 'driver_id', 'COLUMN';
    EXEC sp_rename 'transport_order.estado', 'status', 'COLUMN';
    EXEC sp_rename 'transport_order.fecha_creacion', 'created_at', 'COLUMN';
END
IF OBJECT_ID('ot_historial', 'U') IS NOT NULL
BEGIN
    EXEC sp_rename 'ot_historial', 'order_history';
    EXEC sp_rename 'order_history.ot_id', 'order_id', 'COLUMN';
    EXEC sp_rename 'order_history.estado_anterior', 'previous_status', 'COLUMN';
    EXEC sp_rename 'order_history.estado_nuevo', 'new_status', 'COLUMN';
    EXEC sp_rename 'order_history.fecha_cambio', 'changed_at', 'COLUMN';
    EXEC sp_rename 'order_history.usuario_id', 'user_id', 'COLUMN';
END
GO

-- 2b. Columns that were already named with a unit suffix
IF COL_LENGTH('vehicle', 'capacidad_kg') IS NOT NULL
    EXEC sp_rename 'vehicle.capacidad_kg', 'capacity_kg', 'COLUMN';
IF COL_LENGTH('transport_order', 'peso_kg') IS NOT NULL
    EXEC sp_rename 'transport_order.peso_kg', 'weight_kg', 'COLUMN';
GO

-- 3. Translate the stored values (status codes and roles are English; the screens show them in Spanish)
UPDATE app_user SET role = CASE role
    WHEN 'despachador' THEN 'dispatcher' WHEN 'conductor' THEN 'driver' WHEN 'administrador' THEN 'admin' ELSE role END;

UPDATE transport_order SET status = CASE status
    WHEN 'Creada' THEN 'Created' WHEN 'Programada' THEN 'Scheduled' WHEN 'En ruta' THEN 'InTransit'
    WHEN 'Entregada' THEN 'Delivered' WHEN 'Fallida' THEN 'Failed' ELSE status END;

UPDATE order_history SET
    previous_status = CASE previous_status
        WHEN 'Creada' THEN 'Created' WHEN 'Programada' THEN 'Scheduled' WHEN 'En ruta' THEN 'InTransit'
        WHEN 'Entregada' THEN 'Delivered' WHEN 'Fallida' THEN 'Failed' ELSE previous_status END,
    new_status = CASE new_status
        WHEN 'Creada' THEN 'Created' WHEN 'Programada' THEN 'Scheduled' WHEN 'En ruta' THEN 'InTransit'
        WHEN 'Entregada' THEN 'Delivered' WHEN 'Fallida' THEN 'Failed' ELSE new_status END;
GO

-- 4. Constraints again, with the English values
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_app_user_role')
    ALTER TABLE app_user ADD CONSTRAINT ck_app_user_role CHECK (role IN ('dispatcher', 'driver', 'admin', 'supervisor'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_transport_order_status')
    ALTER TABLE transport_order ADD CONSTRAINT ck_transport_order_status
        CHECK (status IN ('Created', 'Scheduled', 'InTransit', 'Delivered', 'Failed'));
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'df_transport_order_status')
    ALTER TABLE transport_order ADD CONSTRAINT df_transport_order_status DEFAULT 'Created' FOR status;
GO

-- 5. Proof of delivery: photo of the signed guide and the RUT of whoever received the cargo
IF COL_LENGTH('transport_order', 'receiver_tax_id') IS NULL
    ALTER TABLE transport_order ADD receiver_tax_id VARCHAR(20) NULL;
IF COL_LENGTH('transport_order', 'delivery_photo') IS NULL
    ALTER TABLE transport_order ADD delivery_photo VARCHAR(MAX) NULL;
GO

-- 6. The old Spanish procedures are replaced by the English ones in procedures.sql
DROP PROCEDURE IF EXISTS sp_crear_ot;
DROP PROCEDURE IF EXISTS sp_programar_ot;
DROP PROCEDURE IF EXISTS sp_cambiar_estado_ot;
GO
