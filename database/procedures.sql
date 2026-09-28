USE swot_db;
GO

-- 1. Procedimiento para CREAR OT
CREATE OR ALTER PROCEDURE sp_crear_ot
    @cliente_id INT,
    @peso_kg DECIMAL(10,2),
    @usuario_id INT
AS
BEGIN
    DECLARE @ot_id INT;
    
    INSERT INTO orden_transporte (cliente_id, peso_kg, estado)
    VALUES (@cliente_id, @peso_kg, 'Creada');
    
    SET @ot_id = SCOPE_IDENTITY();
    
    INSERT INTO ot_historial (ot_id, estado_anterior, estado_nuevo, usuario_id)
    VALUES (@ot_id, NULL, 'Creada', @usuario_id);
    
    -- Devuelve la ID de la OT recién creada
    SELECT @ot_id AS id_ot_nueva;
END;
GO

-- 2. Procedimiento para PROGRAMAR OT
CREATE OR ALTER PROCEDURE sp_programar_ot
    @ot_id INT,
    @vehiculo_id INT,
    @conductor_id INT,
    @usuario_id INT
AS
BEGIN
    DECLARE @estado_actual VARCHAR(20);
    SELECT @estado_actual = estado FROM orden_transporte WHERE id = @ot_id;

    UPDATE orden_transporte
    SET vehiculo_id = @vehiculo_id,
        usuario_conductor_id = @conductor_id,
        estado = 'Programada'
    WHERE id = @ot_id;

    INSERT INTO ot_historial (ot_id, estado_anterior, estado_nuevo, usuario_id)
    VALUES (@ot_id, @estado_actual, 'Programada', @usuario_id);
END;
GO

-- 3. Procedimiento para CAMBIAR ESTADO
CREATE OR ALTER PROCEDURE sp_cambiar_estado_ot
    @ot_id INT,
    @nuevo_estado VARCHAR(20),
    @usuario_id INT
AS
BEGIN
    DECLARE @estado_actual VARCHAR(20);
    SELECT @estado_actual = estado FROM orden_transporte WHERE id = @ot_id;

    UPDATE orden_transporte
    SET estado = @nuevo_estado
    WHERE id = @ot_id;

    INSERT INTO ot_historial (ot_id, estado_anterior, estado_nuevo, usuario_id)
    VALUES (@ot_id, @estado_actual, @nuevo_estado, @usuario_id);
END;
GO