-- Result type for structured return value with success/failure status and error details
DROP TYPE IF EXISTS order_result CASCADE;
CREATE TYPE order_result AS (
    success BOOLEAN,
    order_id INTEGER,
    error_code VARCHAR(5),  -- Changed to 5-char SQLSTATE code
    message TEXT
);


-- Main function to process customer orders with full validation and transaction control
CREATE OR REPLACE FUNCTION process_customer_order(
    p_customer_id INTEGER,
    p_product_id INTEGER,
    p_order_quantity INTEGER,
    p_order_timestamp TIMESTAMP WITH TIME ZONE,
    p_request_id UUID
)
RETURNS order_result
LANGUAGE plpgsql
AS $$
DECLARE
    v_result order_result;
    v_customer_exists BOOLEAN;
    v_customer_active BOOLEAN;
    v_product_exists BOOLEAN;
    v_product_available BOOLEAN;
    v_current_inventory INTEGER;
    v_unit_price NUMERIC(12, 2);
    v_total_price NUMERIC(12, 2);
    v_new_order_id INTEGER;
    v_duplicate_exists BOOLEAN;
    v_audit_request_id UUID;  -- Fallback UUID for audit logging when request_id is NULL
BEGIN
    -- Initialize result structure with default failure state
    v_result.success := FALSE;
    v_result.order_id := NULL;
    v_result.error_code := '99999';  -- Default PostgreSQL-style error code
    v_result.message := NULL;

    -- Generate fallback UUID for audit logging if request_id is NULL
    -- This ensures audit log entries can always be created even for invalid requests
    v_audit_request_id := COALESCE(p_request_id, gen_random_uuid());

    -- Validate request_id first (before other validations) since it's required for idempotency
    IF p_request_id IS NULL THEN
        v_result.error_code := '22023';  -- PostgreSQL: invalid parameter value
        v_result.message := 'Invalid input: request_id cannot be null';
        
        -- Use generated fallback UUID for audit log to satisfy NOT NULL constraint
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (v_audit_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'null_request_id', 'generated_audit_id', v_audit_request_id::TEXT));
        
        RETURN v_result;
    END IF;

    -- Validate customer_id input parameter
    IF p_customer_id IS NULL THEN
        v_result.error_code := '22023';  -- PostgreSQL: invalid parameter value
        v_result.message := 'Invalid input: customer_id cannot be null';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'null_customer_id'));
        
        RETURN v_result;
    END IF;

    -- Validate product_id input parameter
    IF p_product_id IS NULL THEN
        v_result.error_code := '22023';  -- PostgreSQL: invalid parameter value
        v_result.message := 'Invalid input: product_id cannot be null';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'null_product_id'));
        
        RETURN v_result;
    END IF;

    -- Validate order_quantity input parameter
    IF p_order_quantity IS NULL THEN
        v_result.error_code := '22023';  -- PostgreSQL: invalid parameter value
        v_result.message := 'Invalid input: order_quantity cannot be null';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'null_order_quantity'));
        
        RETURN v_result;
    END IF;

    -- Validate order_timestamp input parameter
    IF p_order_timestamp IS NULL THEN
        v_result.error_code := '22023';  -- PostgreSQL: invalid parameter value
        v_result.message := 'Invalid input: order_timestamp cannot be null';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'null_order_timestamp'));
        
        RETURN v_result;
    END IF;

    -- Validate order_quantity is positive (edge case: negative or zero quantities)
    IF p_order_quantity <= 0 THEN
        v_result.error_code := '2201W';  -- PostgreSQL: invalid parameter value for numeric
        v_result.message := 'Invalid input: order_quantity must be greater than zero';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'invalid_quantity', 'provided_quantity', p_order_quantity));
        
        RETURN v_result;
    END IF;

    -- Check for duplicate request_id to prevent duplicate order processing (idempotency)
    SELECT EXISTS(SELECT 1 FROM orders WHERE request_id = p_request_id) INTO v_duplicate_exists;
    
    IF v_duplicate_exists THEN
        v_result.error_code := '23505';  -- PostgreSQL: unique_violation
        v_result.message := 'Duplicate request: order with this request_id already exists';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'duplicate_request_id'));
        
        RETURN v_result;
    END IF;

    -- Verify customer exists in the system
    SELECT EXISTS(SELECT 1 FROM customers WHERE customer_id = p_customer_id) INTO v_customer_exists;
    
    IF NOT v_customer_exists THEN
        v_result.error_code := 'P0002';  -- PostgreSQL: no_data_found
        v_result.message := 'Customer not found: no customer exists with the provided customer_id';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'customer_not_found'));
        
        RETURN v_result;
    END IF;

    -- Verify customer account is active (edge case: inactive customers cannot place orders)
    SELECT is_active INTO v_customer_active FROM customers WHERE customer_id = p_customer_id;
    
    IF NOT v_customer_active THEN
        v_result.error_code := '23514';  -- PostgreSQL: check_violation (customer check constraint)
        v_result.message := 'Customer inactive: the customer account is not active';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'customer_inactive'));
        
        RETURN v_result;
    END IF;

    -- Verify product exists in the catalog
    SELECT EXISTS(SELECT 1 FROM products WHERE product_id = p_product_id) INTO v_product_exists;
    
    IF NOT v_product_exists THEN
        v_result.error_code := 'P0002';  -- PostgreSQL: no_data_found
        v_result.message := 'Product not found: no product exists with the provided product_id';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'product_not_found'));
        
        RETURN v_result;
    END IF;

    -- Verify product is available for sale and get current unit price
    SELECT is_available, unit_price INTO v_product_available, v_unit_price 
    FROM products WHERE product_id = p_product_id;
    
    IF NOT v_product_available THEN
        v_result.error_code := '23514';  -- PostgreSQL: check_violation (product availability check)
        v_result.message := 'Product unavailable: the product is not available for sale';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'product_unavailable'));
        
        RETURN v_result;
    END IF;

    -- Check inventory with row-level lock (FOR UPDATE) to prevent race conditions
    SELECT quantity INTO v_current_inventory 
    FROM inventory 
    WHERE product_id = p_product_id
    FOR UPDATE;
    
    IF v_current_inventory IS NULL THEN
        v_result.error_code := 'P0002';  -- PostgreSQL: no_data_found
        v_result.message := 'Inventory not found: no inventory record exists for the product';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'inventory_not_found'));
        
        RETURN v_result;
    END IF;

    -- Verify sufficient inventory exists (edge case: out-of-stock products)
    IF v_current_inventory < p_order_quantity THEN
        v_result.error_code := '55000';  -- PostgreSQL: insufficient resources
        v_result.message := 'Insufficient inventory: not enough stock available for the requested quantity';
        
        INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
        VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                jsonb_build_object('reason', 'insufficient_inventory', 'available', v_current_inventory, 'requested', p_order_quantity));
        
        RETURN v_result;
    END IF;

    -- Calculate total order price using current unit price
    v_total_price := v_unit_price * p_order_quantity;

    -- BEGIN EXPLICIT TRANSACTION BLOCK
    -- Use savepoint for explicit transaction control within the function
    -- All operations below must succeed together or roll back as a unit
    BEGIN
        -- Create savepoint for explicit rollback capability
        -- This ensures atomicity: order creation, inventory update, and audit log succeed or fail together
        
        -- Step 1: Insert new order record with PENDING status
        INSERT INTO orders (
            customer_id,
            product_id,
            quantity,
            unit_price,
            total_price,
            status,
            request_id,
            order_timestamp
        ) VALUES (
            p_customer_id,
            p_product_id,
            p_order_quantity,
            v_unit_price,
            v_total_price,
            'PENDING',
            p_request_id,
            p_order_timestamp
        ) RETURNING order_id INTO v_new_order_id;

        -- Step 2: Deduct ordered quantity from inventory
        UPDATE inventory
        SET quantity = quantity - p_order_quantity,
            last_updated = CURRENT_TIMESTAMP
        WHERE product_id = p_product_id;

        -- Step 3: Record successful operation in audit log
        INSERT INTO order_audit_log (
            order_id,
            request_id,
            customer_id,
            product_id,
            action,
            status,
            error_code,
            message,
            details
        ) VALUES (
            v_new_order_id,
            p_request_id,
            p_customer_id,
            p_product_id,
            'PROCESS_ORDER',
            'SUCCESS',
            '00000',  -- PostgreSQL: successful completion
            'Order processed successfully',
            jsonb_build_object(
                'order_id', v_new_order_id,
                'quantity', p_order_quantity,
                'unit_price', v_unit_price,
                'total_price', v_total_price,
                'inventory_before', v_current_inventory,
                'inventory_after', v_current_inventory - p_order_quantity
            )
        );

        -- All operations succeeded - set success result
        v_result.success := TRUE;
        v_result.order_id := v_new_order_id;
        v_result.error_code := '00000';  -- PostgreSQL: successful completion
        v_result.message := 'Order processed successfully';

        -- Transaction commits implicitly on successful return
        RETURN v_result;

    -- EXCEPTION BLOCK: Handles errors and performs implicit rollback of the BEGIN block
    -- PostgreSQL automatically rolls back to the start of this BEGIN block on any exception
    EXCEPTION
        -- Handle unique constraint violations (e.g., duplicate request_id race condition)
        WHEN unique_violation THEN
            v_result.error_code := '23505';  -- PostgreSQL: unique_violation
            v_result.message := 'Constraint violation: duplicate entry detected';
            
            INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
            VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                    jsonb_build_object('reason', 'unique_violation', 'sqlstate', SQLSTATE));
            
            RETURN v_result;

        -- Handle check constraint violations (e.g., negative inventory after update)
        WHEN check_violation THEN
            v_result.error_code := '23514';  -- PostgreSQL: check_violation
            v_result.message := 'Constraint violation: check constraint failed';
            
            INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
            VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                    jsonb_build_object('reason', 'check_violation', 'sqlstate', SQLSTATE));
            
            RETURN v_result;

        -- Handle foreign key constraint violations
        WHEN foreign_key_violation THEN
            v_result.error_code := '23503';  -- PostgreSQL: foreign_key_violation
            v_result.message := 'Constraint violation: foreign key constraint failed';
            
            INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
            VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                    jsonb_build_object('reason', 'foreign_key_violation', 'sqlstate', SQLSTATE));
            
            RETURN v_result;

        -- Catch-all handler for any other unexpected errors
        WHEN OTHERS THEN
            v_result.error_code := SQLSTATE;  -- Use the actual PostgreSQL SQLSTATE
            v_result.message := 'Unexpected error: ' || SQLERRM;
            
            INSERT INTO order_audit_log (request_id, customer_id, product_id, action, status, error_code, message, details)
            VALUES (p_request_id, p_customer_id, p_product_id, 'PROCESS_ORDER', 'FAILED', v_result.error_code, v_result.message,
                    jsonb_build_object('reason', 'unexpected_error', 'sqlstate', SQLSTATE, 'sqlerrm', SQLERRM));
            
            RETURN v_result;
    -- END EXPLICIT TRANSACTION BLOCK
    END;

END;
$$;
