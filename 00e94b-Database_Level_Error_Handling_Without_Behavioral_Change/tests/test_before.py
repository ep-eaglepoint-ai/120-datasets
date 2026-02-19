import pytest
import psycopg
import os
from conftest import load_sql_file

SQL_BEFORE = os.path.join(os.path.dirname(__file__), "../repository_before/db-level-error-handling.sql")

def test_orphan_user_integrity_before(setup_schema):
    """
    Case: A user confirms their email, but has no corresponding 'parent' record.
    Expected: the logic silently ignores this, so the test expecting an error FAILS.
    """
    conn = setup_schema
    load_sql_file(conn, SQL_BEFORE)
    
    with conn.cursor() as cur:
        cur.execute("INSERT INTO auth.users (id, confirmed_at) VALUES ('00000000-0000-0000-0000-000000000001', NULL)")
        
        # We expect this logic to be flawed, that's it should raise an Integrity Error but it won't.
        with pytest.raises(psycopg.errors.IntegrityConstraintViolation):
             cur.execute("UPDATE auth.users SET confirmed_at = NOW() WHERE id = '00000000-0000-0000-0000-000000000001'")

def test_invalid_trigger_event_before(setup_schema):
    """
    Case: The trigger function is attached to an INSERT event.
    Expected: SQL_BEFORE logic allows this invalid usage without error, so the test expecting an error FAILS.
    """
    conn = setup_schema
    load_sql_file(conn, SQL_BEFORE)
    
    with conn.cursor() as cur:
        cur.execute("DROP TRIGGER IF EXISTS test_invalid_trigger ON auth.users")
        cur.execute("""
            CREATE TRIGGER test_invalid_trigger
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION cancel_unverified_parent_emails()
        """)
        
        # We expect strict validation to raise an error. Before logic lacks this.
        # This failing proves the logic is lenient/flawed.
        with pytest.raises(psycopg.errors.TriggeredActionException):
             cur.execute("INSERT INTO auth.users (id, confirmed_at) VALUES ('00000000-0000-0000-0000-000000000099', NOW())")
