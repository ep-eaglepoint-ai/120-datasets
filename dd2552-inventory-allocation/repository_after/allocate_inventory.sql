CREATE OR REPLACE FUNCTION allocate_inventory(
    p_order_id BIGINT,
    p_warehouse_id BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_allocated_count INT;
BEGIN
    -- Requirement 7 & 1: Performance Improvement
    -- Short-circuit for empty orders to avoid CTE overhead.
    -- Assuming an empty order requires no allocation and is effectively "successful".
    IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id) THEN
        RETURN TRUE;
    END IF;

    -- Requirements 1, 2, 3, 4, 5, 10, 15: Single Atomic Statement
    WITH order_demand AS (
        -- Aggregate demand per product to avoid duplicates (Req 8)
        SELECT product_id, SUM(quantity) AS qty
        FROM order_items
        WHERE order_id = p_order_id
        GROUP BY product_id
    ),
    locked_inventory AS (
        -- Req 3: Minimize lock duration (locked only during this statement execution)
        -- Req 10: Consistent results (FOR UPDATE prevents concurrent modifications)
        -- Req 2: Bulk selection (Avoid looping)
        SELECT 
            i.product_id, 
            i.stock_quantity,
            od.qty
        FROM inventory i
        JOIN order_demand od ON i.product_id = od.product_id
        WHERE i.warehouse_id = p_warehouse_id
        ORDER BY i.product_id -- Req 10: Deterministic locking order to prevent deadlocks
        FOR UPDATE
    ),
    validation AS (
        -- Req 3 & 5: Validate ALL items are available and sufficient BEFORE updating
        SELECT 
            -- Check 1: Did we find inventory rows for ALL requested products?
            (COUNT(*) = (SELECT COUNT(*) FROM order_demand)) AS all_items_found,
            -- Check 2: Is stock sufficient for ALL items? (Req 5: Prevent partial updates)
            BOOL_AND(stock_quantity >= qty) AS all_items_sufficient
        FROM locked_inventory
    ),
    perform_update AS (
        -- Req 5: All-or-nothing update based on validation
        UPDATE inventory i
        SET stock_quantity = i.stock_quantity - li.qty
        FROM locked_inventory li, validation v
        WHERE i.product_id = li.product_id
          AND i.warehouse_id = p_warehouse_id
          AND v.all_items_found      -- Only proceed if all items exist
          AND v.all_items_sufficient -- Only proceed if all items are sufficient
        RETURNING i.product_id
    )
    -- Capture result count
    SELECT COUNT(*) INTO v_allocated_count FROM perform_update;

    -- Req 6 & 8: Return Logic
    -- If update occurred, count > 0 (Success). 
    -- If validation failed, count = 0 (Failure).
    RETURN v_allocated_count > 0;
END;
$$;
