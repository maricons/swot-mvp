USE swot_db;
GO

-- 1. Create an order together with its product lines (all or nothing)
-- @items is a JSON array: [{"product_id": 1, "quantity": 5}, ...]
CREATE OR ALTER PROCEDURE sp_create_order
    @customer_id INT,
    @weight_kg DECIMAL(10,2),
    @user_id INT,
    @due_date DATE = NULL,
    @items NVARCHAR(MAX) = NULL
AS
BEGIN
    SET XACT_ABORT ON;
    DECLARE @order_id INT;

    BEGIN TRAN;

    INSERT INTO transport_order (customer_id, weight_kg, status, due_date)
    VALUES (@customer_id, @weight_kg, 'Created', @due_date);

    SET @order_id = SCOPE_IDENTITY();

    INSERT INTO order_history (order_id, previous_status, new_status, user_id)
    VALUES (@order_id, NULL, 'Created', @user_id);

    IF @items IS NOT NULL
        INSERT INTO order_item (order_id, product_id, quantity)
        SELECT @order_id, product_id, quantity
        FROM OPENJSON(@items) WITH (product_id INT '$.product_id', quantity INT '$.quantity');

    COMMIT;

    SELECT @order_id AS order_id;
END;
GO

-- 2. Schedule an order: assign vehicle and driver
CREATE OR ALTER PROCEDURE sp_schedule_order
    @order_id INT,
    @vehicle_id INT,
    @driver_id INT,
    @user_id INT
AS
BEGIN
    SET XACT_ABORT ON;
    DECLARE @previous_status VARCHAR(20);

    BEGIN TRAN;

    SELECT @previous_status = status FROM transport_order WHERE id = @order_id;

    UPDATE transport_order
    SET vehicle_id = @vehicle_id, driver_id = @driver_id, status = 'Scheduled'
    WHERE id = @order_id;

    INSERT INTO order_history (order_id, previous_status, new_status, user_id)
    VALUES (@order_id, @previous_status, 'Scheduled', @user_id);

    COMMIT;
END;
GO

-- 3. Change the status. On delivery it stores the moment, whether it was complete (OTIF)
-- and the proof of delivery (receiver RUT + photo of the signed guide)
CREATE OR ALTER PROCEDURE sp_change_order_status
    @order_id INT,
    @new_status VARCHAR(20),
    @user_id INT,
    @in_full BIT = NULL,
    @receiver_tax_id VARCHAR(20) = NULL,
    @delivery_photo VARCHAR(MAX) = NULL
AS
BEGIN
    SET XACT_ABORT ON;
    DECLARE @previous_status VARCHAR(20);

    BEGIN TRAN;

    SELECT @previous_status = status FROM transport_order WHERE id = @order_id;

    UPDATE transport_order
    SET status = @new_status,
        delivered_at = CASE WHEN @new_status = 'Delivered' THEN GETDATE() ELSE delivered_at END,
        in_full = CASE WHEN @new_status = 'Delivered' THEN ISNULL(@in_full, 1) ELSE in_full END,
        receiver_tax_id = CASE WHEN @new_status = 'Delivered' THEN @receiver_tax_id ELSE receiver_tax_id END,
        delivery_photo = CASE WHEN @new_status = 'Delivered' THEN @delivery_photo ELSE delivery_photo END
    WHERE id = @order_id;

    INSERT INTO order_history (order_id, previous_status, new_status, user_id)
    VALUES (@order_id, @previous_status, @new_status, @user_id);

    -- The truck stops being tracked when its driver has no other order in transit
    IF @new_status IN ('Delivered', 'Failed')
        DELETE FROM truck_position
        WHERE driver_id = (SELECT driver_id FROM transport_order WHERE id = @order_id)
          AND NOT EXISTS (SELECT 1 FROM transport_order WHERE driver_id = truck_position.driver_id AND status = 'InTransit');

    COMMIT;
END;
GO

-- 4. Save the last known position of a driver's truck
CREATE OR ALTER PROCEDURE sp_save_truck_position
    @driver_id INT,
    @latitude DECIMAL(9,6),
    @longitude DECIMAL(9,6)
AS
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRAN;

    UPDATE truck_position SET latitude = @latitude, longitude = @longitude, recorded_at = GETDATE()
    WHERE driver_id = @driver_id;

    IF @@ROWCOUNT = 0
        INSERT INTO truck_position (driver_id, latitude, longitude) VALUES (@driver_id, @latitude, @longitude);

    COMMIT;
END;
GO

-- 5. Announce a container (creates it as Expected and records the first event)
CREATE OR ALTER PROCEDURE sp_create_container
    @container_number VARCHAR(11),
    @customer_id INT,
    @container_type VARCHAR(4),
    @cargo_type VARCHAR(10),
    @temperature_c DECIMAL(4,1) = NULL,
    @seal_number VARCHAR(20) = NULL,
    @expected_arrival DATE = NULL,
    @planned_departure DATE = NULL,
    @notes VARCHAR(255) = NULL,
    @user_id INT
AS
BEGIN
    SET XACT_ABORT ON;
    DECLARE @container_id INT;

    BEGIN TRAN;

    INSERT INTO container (container_number, customer_id, container_type, cargo_type, temperature_c, seal_number,
                           expected_arrival, planned_departure, notes)
    VALUES (@container_number, @customer_id, @container_type, @cargo_type, @temperature_c, @seal_number,
            @expected_arrival, @planned_departure, @notes);

    SET @container_id = SCOPE_IDENTITY();

    INSERT INTO container_event (container_id, event_type, user_id) VALUES (@container_id, 'Announced', @user_id);

    COMMIT;

    SELECT @container_id AS container_id;
END;
GO

-- 6. Arrival, move inside the yard, or departure of a container (the API checks the allowed transitions)
CREATE OR ALTER PROCEDURE sp_register_container_event
    @container_id INT,
    @event_type VARCHAR(10),
    @yard_location VARCHAR(20) = NULL,
    @seal_number VARCHAR(20) = NULL,
    @notes VARCHAR(255) = NULL,
    @user_id INT
AS
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRAN;

    IF @event_type = 'Arrived'
        UPDATE container
        SET status = 'InYard', arrived_at = GETDATE(), yard_location = @yard_location,
            seal_number = COALESCE(@seal_number, seal_number)
        WHERE id = @container_id;
    ELSE IF @event_type = 'Moved'
        UPDATE container SET yard_location = @yard_location WHERE id = @container_id;
    ELSE IF @event_type = 'Departed'
        UPDATE container SET status = 'Departed', departed_at = GETDATE(), yard_location = NULL WHERE id = @container_id;

    INSERT INTO container_event (container_id, event_type, yard_location, notes, user_id)
    VALUES (@container_id, @event_type, @yard_location, @notes, @user_id);

    COMMIT;
END;
GO

-- 7. Set a new password from a recovery link: saves it, ends the old sessions and closes the user's open links
CREATE OR ALTER PROCEDURE sp_reset_password
    @reset_id INT,
    @user_id INT,
    @password_hash VARCHAR(255)
AS
BEGIN
    SET XACT_ABORT ON;
    BEGIN TRAN;

    UPDATE app_user SET password_hash = @password_hash, password_changed_at = GETDATE() WHERE id = @user_id;
    UPDATE password_reset SET used_at = GETDATE() WHERE user_id = @user_id AND used_at IS NULL;

    COMMIT;
END;
GO
