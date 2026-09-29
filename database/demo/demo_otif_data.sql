-- Demo data to see the OTIF screen with something to show: 53 finished orders from March to
-- September 2026 whose service improves over the months (some late, some incomplete, a few failed).
-- Safe to run more than once: it does nothing if there are already orders before 2026-09-26.
-- Run it from the backend folder:  node scripts/run_sql.js ../database/demo/demo_otif_data.sql
--
-- To remove it later (real orders are all created after 2026-09-26):
--   DELETE FROM order_history WHERE order_id IN (SELECT id FROM transport_order WHERE created_at < '2026-09-26');
--   DELETE FROM order_item    WHERE order_id IN (SELECT id FROM transport_order WHERE created_at < '2026-09-26');
--   DELETE FROM transport_order WHERE created_at < '2026-09-26';
USE swot_db;
GO

IF NOT EXISTS (SELECT 1 FROM transport_order WHERE created_at < '2026-09-26')
BEGIN
    DECLARE @alpha INT = (SELECT id FROM customer WHERE name = 'Empresa Alpha');
    DECLARE @beta INT = (SELECT id FROM customer WHERE name = 'Comercial Beta');
    DECLARE @truck INT = (SELECT id FROM vehicle WHERE plate = 'AB1234');
    DECLARE @juan INT = (SELECT id FROM app_user WHERE email = 'conductor@swot.cl');
    DECLARE @pedro INT = (SELECT id FROM app_user WHERE email = 'driver2@swot.cl');
    DECLARE @dispatcher INT = (SELECT id FROM app_user WHERE email = 'despachador@swot.cl');
    DECLARE @order INT;

    IF @alpha IS NULL OR @beta IS NULL OR @truck IS NULL OR @juan IS NULL OR @pedro IS NULL OR @dispatcher IS NULL
        THROW 50000, 'The test customers, vehicle and users of init.sql are needed to load the demo data.', 1;

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 1738, '2026-03-03 11:00:00', '2026-03-05', '2026-03-05 10:29:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-03 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-03 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-05 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-03-05 10:29:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 383, '2026-03-06 11:00:00', '2026-03-10', '2026-03-13 12:24:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-06 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-06 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-13 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-03-13 12:24:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 1565, '2026-03-07 12:00:00', '2026-03-12', '2026-03-11 11:49:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-07 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-07 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-11 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-03-11 11:49:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3376, '2026-03-11 09:00:00', '2026-03-14', '2026-03-14 13:21:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-11 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-11 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-14 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-03-14 13:21:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 3226, '2026-03-15 12:00:00', '2026-03-17', '2026-03-16 15:43:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-16 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-03-16 15:43:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 4102, '2026-03-25 12:00:00', '2026-03-27', '2026-03-28 18:53:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-03-25 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-03-25 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-03-28 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-03-28 18:53:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 116, '2026-04-06 09:00:00', '2026-04-08', '2026-04-08 10:33:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-06 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-06 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-08 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-04-08 10:33:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3643, '2026-04-12 08:00:00', '2026-04-18', '2026-04-17 09:56:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-12 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-12 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-17 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-04-17 09:56:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 593, '2026-04-15 15:00:00', '2026-04-21', '2026-04-20 13:11:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-20 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-04-20 13:11:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 2441, '2026-04-19 15:00:00', '2026-04-24', '2026-04-23 10:06:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-19 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-19 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-23 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-04-23 10:06:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 1057, '2026-04-21 11:00:00', '2026-04-23', '2026-04-25 16:24:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-21 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-21 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-25 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-04-25 16:24:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 982, '2026-04-21 11:00:00', '2026-04-25', '2026-04-25 17:38:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-21 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-21 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-25 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-04-25 17:38:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Failed', 3897, '2026-04-24 14:00:00', '2026-04-27', NULL, NULL, NULL);
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-04-24 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-04-24 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-04-27 07:30:00', @pedro),
(@order, 'InTransit', 'Failed', '2026-04-27 17:30:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 742, '2026-05-03 13:00:00', '2026-05-05', '2026-05-04 16:26:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-03 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-03 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-04 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-05-04 16:26:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 4169, '2026-05-05 11:00:00', '2026-05-11', '2026-05-11 14:41:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-05 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-05 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-11 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-05-11 14:41:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 956, '2026-05-05 13:00:00', '2026-05-08', '2026-05-07 15:24:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-05 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-05 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-07 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-05-07 15:24:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 2022, '2026-05-06 11:00:00', '2026-05-12', '2026-05-11 18:46:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-06 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-06 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-11 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-05-11 18:46:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 1911, '2026-05-08 13:00:00', '2026-05-12', '2026-05-12 16:42:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-08 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-08 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-12 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-05-12 16:42:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3150, '2026-05-12 09:00:00', '2026-05-16', '2026-05-18 09:35:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-12 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-12 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-18 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-05-18 09:35:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 292, '2026-05-15 11:00:00', '2026-05-18', '2026-05-18 15:54:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-05-18 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-05-18 15:54:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 3993, '2026-05-31 11:00:00', '2026-06-06', '2026-06-05 15:04:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-05-31 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-05-31 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-05 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-06-05 15:04:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Failed', 1449, '2026-06-01 10:00:00', '2026-06-05', NULL, NULL, NULL);
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-01 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-01 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-05 07:30:00', @juan),
(@order, 'InTransit', 'Failed', '2026-06-05 17:30:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 2859, '2026-06-03 14:00:00', '2026-06-06', '2026-06-06 09:16:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-03 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-03 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-06 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-06-06 09:16:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 1348, '2026-06-08 11:00:00', '2026-06-13', '2026-06-12 14:41:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-08 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-08 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-12 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-06-12 14:41:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 3151, '2026-06-11 10:00:00', '2026-06-15', '2026-06-17 17:57:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-11 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-11 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-17 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-06-17 17:57:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 2935, '2026-06-18 15:00:00', '2026-06-23', '2026-06-22 12:30:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-18 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-18 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-22 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-06-22 12:30:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 2378, '2026-06-20 08:00:00', '2026-06-26', '2026-06-26 16:24:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-20 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-20 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-26 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-06-26 16:24:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 4091, '2026-06-23 13:00:00', '2026-06-27', '2026-06-26 11:29:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-06-23 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-06-23 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-06-26 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-06-26 11:29:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 804, '2026-07-02 15:00:00', '2026-07-06', '2026-07-08 17:53:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-02 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-02 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-08 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-07-08 17:53:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Failed', 2289, '2026-07-05 13:00:00', '2026-07-09', NULL, NULL, NULL);
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-05 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-05 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-09 07:30:00', @pedro),
(@order, 'InTransit', 'Failed', '2026-07-09 17:30:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3633, '2026-07-07 11:00:00', '2026-07-12', '2026-07-13 10:56:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-07 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-07 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-13 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-07-13 10:56:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 2291, '2026-07-09 10:00:00', '2026-07-13', '2026-07-13 18:12:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-09 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-09 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-13 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-07-13 18:12:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 2927, '2026-07-11 12:00:00', '2026-07-17', '2026-07-20 11:54:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-11 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-11 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-20 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-07-20 11:54:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 1214, '2026-07-14 11:00:00', '2026-07-18', '2026-07-18 18:30:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-14 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-14 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-18 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-07-18 18:30:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 3759, '2026-07-15 12:00:00', '2026-07-19', '2026-07-19 10:05:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-19 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-07-19 10:05:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 508, '2026-07-18 15:00:00', '2026-07-24', '2026-07-24 11:59:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-07-18 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-07-18 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-07-24 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-07-24 11:59:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3163, '2026-08-02 13:00:00', '2026-08-06', '2026-08-06 10:57:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-02 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-02 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-06 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-08-06 10:57:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 1725, '2026-08-06 14:00:00', '2026-08-10', '2026-08-10 12:09:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-06 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-06 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-10 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-10 12:09:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 2750, '2026-08-07 08:00:00', '2026-08-10', '2026-08-09 18:13:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-07 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-07 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-09 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-08-09 18:13:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 1225, '2026-08-07 11:00:00', '2026-08-11', '2026-08-11 13:19:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-07 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-07 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-11 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-08-11 13:19:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 3538, '2026-08-10 10:00:00', '2026-08-13', '2026-08-12 10:12:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-10 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-10 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-12 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-12 10:12:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 123, '2026-08-12 14:00:00', '2026-08-14', '2026-08-16 16:02:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-12 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-12 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-16 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-16 16:02:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 1711, '2026-08-13 11:00:00', '2026-08-17', '2026-08-16 18:40:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-13 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-13 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-16 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-16 18:40:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 2881, '2026-08-15 15:00:00', '2026-08-21', '2026-08-21 16:46:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-21 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-21 16:46:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 1383, '2026-08-16 15:00:00', '2026-08-21', '2026-08-20 10:13:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-16 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-16 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-08-20 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-08-20 10:13:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 1314, '2026-08-30 11:00:00', '2026-09-04', '2026-09-03 15:11:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-08-30 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-08-30 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-03 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-09-03 15:11:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 3969, '2026-09-02 12:00:00', '2026-09-04', '2026-09-03 13:14:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-02 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-02 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-03 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-09-03 13:14:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 412, '2026-09-02 10:00:00', '2026-09-05', '2026-09-04 16:17:00', 0, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-02 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-02 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-04 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-09-04 16:17:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 3582, '2026-09-07 15:00:00', '2026-09-09', '2026-09-08 15:04:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-07 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-07 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-08 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-09-08 15:04:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @juan, 'Delivered', 112, '2026-09-08 09:00:00', '2026-09-14', '2026-09-13 16:16:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-08 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-08 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-13 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-09-13 16:16:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @juan, 'Delivered', 1649, '2026-09-14 13:00:00', '2026-09-18', '2026-09-17 11:21:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-14 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-14 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-17 07:30:00', @juan),
(@order, 'InTransit', 'Delivered', '2026-09-17 11:21:00', @juan);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@alpha, @truck, @pedro, 'Delivered', 3734, '2026-09-15 09:00:00', '2026-09-19', '2026-09-19 10:04:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-15 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-15 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-19 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-09-19 10:04:00', @pedro);

INSERT INTO transport_order (customer_id, vehicle_id, driver_id, status, weight_kg, created_at, due_date, delivered_at, in_full, receiver_tax_id)
VALUES (@beta, @truck, @pedro, 'Delivered', 1287, '2026-09-16 08:00:00', '2026-09-22', '2026-09-22 18:08:00', 1, '11.111.111-1');
SET @order = SCOPE_IDENTITY();
INSERT INTO order_history (order_id, previous_status, new_status, changed_at, user_id) VALUES
(@order, NULL, 'Created', '2026-09-16 09:00:00', @dispatcher),
(@order, 'Created', 'Scheduled', '2026-09-16 10:00:00', @dispatcher),
(@order, 'Scheduled', 'InTransit', '2026-09-22 07:30:00', @pedro),
(@order, 'InTransit', 'Delivered', '2026-09-22 18:08:00', @pedro);
END
GO
