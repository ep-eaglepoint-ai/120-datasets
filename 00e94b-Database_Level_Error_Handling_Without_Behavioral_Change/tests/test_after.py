import pytest
import psycopg
import os
from conftest import load_sql_file

SQL_AFTER = os.path.join(os.path.dirname(__file__), "../repository_after/db-level-error-handling.sql")

def test_standard_sqlstates(setup_schema):
    """
    Requirements: 
    1. Errors must be raised using RAISE EXCEPTION ... USING ERRCODE
    2. SQLSTATE codes must be standard PostgreSQL SQLSTATEs and Semantically accurate
    
    Verifies that specific failure conditions return the exact standard SQLSTATEs defined.
    """
    conn = setup_schema
    load_sql_file(conn, SQL_AFTER)
    
    with conn.cursor() as cur:
        # Case A: Invalid Trigger Event (Standard: 09000 - triggered_action_exception)
        cur.execute("DROP TRIGGER IF EXISTS test_invalid_op_trigger ON auth.users")
        cur.execute("""
            CREATE TRIGGER test_invalid_op_trigger
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION cancel_unverified_parent_emails()
        """)
        
        with pytest.raises(psycopg.errors.TriggeredActionException) as excinfo:
             cur.execute("INSERT INTO auth.users (id, confirmed_at) VALUES ('00000000-0000-0000-0000-000000000099', NOW())")
        assert excinfo.value.sqlstate == '09000', "Must use standard code for trigger misuse"

        # Cleanup: Remove invalid trigger so we can insert data for next test
        cur.execute("DROP TRIGGER IF EXISTS test_invalid_op_trigger ON auth.users")

        # Case B: Integrity/Orphan User (Standard: 23000 - integrity_constraint_violation)
        # Create user without parent
        cur.execute("INSERT INTO auth.users (id, confirmed_at) VALUES ('00000000-0000-0000-0000-000000000001', NULL)")
        
        with pytest.raises(psycopg.errors.IntegrityConstraintViolation) as excinfo:
            cur.execute("UPDATE auth.users SET confirmed_at = NOW() WHERE id = '00000000-0000-0000-0000-000000000001'")
        assert excinfo.value.sqlstate == '23000', "Must use standard code for missing related record"

def test_preserve_logic_and_behavior(setup_schema):
    """
    Requirement: Existing logic and behavior must be preserved.
    
    Verifies:
    A. Task Cancellation happens (Happy Path)
    B. NO Cancellation triggers if confirmed_at stays NULL (No-op 1)
    C. NO Cancellation triggers if confirmed_at updates from Value -> Value (No-op 2)
    """
    conn = setup_schema
    load_sql_file(conn, SQL_AFTER)
    
    with conn.cursor() as cur:
        # Setup helpers
        pid = '00000000-0000-0000-0000-000000000020'
        uid = '00000000-0000-0000-0000-000000000020'
        
        cur.execute("INSERT INTO auth.users (id, confirmed_at) VALUES (%s, NULL)", (uid,))
        cur.execute("INSERT INTO public.parents (uuid, supabase_id) VALUES (%s, %s)", (pid, uid))
        
        # A. Happy Path (NULL -> NOW)
        cur.execute("""
            INSERT INTO public.parent_scheduled_tasks (parent_id, task_type, completed_at) 
            VALUES (%s, 'send_unverified_email_3_days', NULL)
        """, (pid,))
        
        cur.execute("UPDATE auth.users SET confirmed_at = NOW() WHERE id = %s", (uid,))
        
        cur.execute("SELECT completed_at, is_cancelled FROM public.parent_scheduled_tasks WHERE parent_id = %s", (pid,))
        row = cur.fetchone()
        assert row[0] is not None, "Logic Failed: Should have completed task"
        assert row[1] is True, "Logic Failed: Should have cancelled task"

        # Reset
        cur.execute("DELETE FROM public.parent_scheduled_tasks")
        
        # B. No-Op Path (NULL -> NULL aka just updating some other field)
        # We need another field to update or just update ID? 
        # Let's Update confirmed_at to NULL (explicitly same value)
        cur.execute("UPDATE auth.users SET confirmed_at = NULL WHERE id = %s", (uid,))
        cur.execute("""
            INSERT INTO public.parent_scheduled_tasks (parent_id, task_type, completed_at) 
            VALUES (%s, 'send_unverified_email_5_days', NULL)
        """, (pid,))
        
        cur.execute("UPDATE auth.users SET confirmed_at = NULL WHERE id = %s", (uid,))
        
        cur.execute("SELECT completed_at, is_cancelled FROM public.parent_scheduled_tasks WHERE parent_id = %s", (pid,))
        row = cur.fetchone()
        assert row[0] is None, "Logic Failed: Should NOT have completed task (NULL->NULL)"
        
        # C. No-Op Path (Value -> Value)
        # First set it to a value (without triggering task logic again creates side effects? No, we reset tasks)
        cur.execute("UPDATE auth.users SET confirmed_at = NOW() WHERE id = %s", (uid,)) 
        cur.execute("DELETE FROM public.parent_scheduled_tasks") # Clear side effects from setup
        
        # Insert new pending task
        cur.execute("""
            INSERT INTO public.parent_scheduled_tasks (parent_id, task_type, completed_at) 
            VALUES (%s, 'send_unverified_email_10_days', NULL)
        """, (pid,))
        
        # Update Value -> New Value
        cur.execute("UPDATE auth.users SET confirmed_at = NOW() WHERE id = %s", (uid,))
        
        cur.execute("SELECT completed_at, is_cancelled FROM public.parent_scheduled_tasks WHERE parent_id = %s", (pid,))
        row = cur.fetchone()
        assert row[0] is None, "Logic Failed: Should NOT have completed task (Value->Value)"

def test_applied_to_function_and_trigger(setup_schema):
    """
    Requirement 5: Changes applied directly to the function and trigger.
    
    Verifies that the database actually contains the function and trigger 
    with the expected names and definitions.
    """
    conn = setup_schema
    load_sql_file(conn, SQL_AFTER)
    
    with conn.cursor() as cur:
        # Check Function Exists
        cur.execute("""
            SELECT proname 
            FROM pg_proc 
            WHERE proname = 'cancel_unverified_parent_emails';
        """)
        assert cur.fetchone() is not None, "Function definition missing"
        
        # Check Trigger Exists
        cur.execute("""
            SELECT tgname 
            FROM pg_trigger 
            WHERE tgname = 'cancel_unverified_emails_trigger';
        """)
        assert cur.fetchone() is not None, "Trigger definition missing"
