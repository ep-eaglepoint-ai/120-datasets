CREATE OR REPLACE FUNCTION allocate_inventory(
    p_order_id BIGINT,
    p_warehouse_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    r_item RECORD;
    v_available INT;
    v_success BOOLEAN := TRUE;
BEGIN
    FOR r_item IN
        SELECT product_id, quantity
        FROM order_items
        WHERE order_id = p_order_id
    LOOP
        SELECT stock_quantity
        INTO v_available
        FROM inventory
        WHERE product_id = r_item.product_id
          AND warehouse_id = p_warehouse_id;

        IF v_available IS NULL THEN
            v_success := FALSE;
        ELSIF v_available < r_item.quantity THEN
            v_success := FALSE;
        ELSE
            UPDATE inventory
            SET stock_quantity = stock_quantity - r_item.quantity
            WHERE product_id = r_item.product_id
              AND warehouse_id = p_warehouse_id;
        END IF;
    END LOOP;

    IF v_success = FALSE THEN
        RAISE NOTICE 'Inventory allocation failed for order %', p_order_id;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;
