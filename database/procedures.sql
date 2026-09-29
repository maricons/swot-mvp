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

    COMMIT;
END;
GO
