import pytest
import psycopg
import os
import time

#env vars for docker
DB_PARAMS = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": os.environ.get("DB_PORT", "5432"),
    "dbname": os.environ.get("DB_NAME", "testdb"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "password")
}

@pytest.fixture(scope="session")
def db_connection():
    # Wait for DB to be ready
    retries = 5
    while retries > 0:
        try:
            conn = psycopg.connect(**DB_PARAMS, autocommit=True)
            yield conn
            conn.close()
            return
        except psycopg.OperationalError:
            time.sleep(1)
            retries -= 1
    raise Exception("Could not connect to database")

@pytest.fixture(scope="function")
def setup_schema(db_connection):
    with db_connection.cursor() as cur:
        # Drop everything to start on fresh
        cur.execute("DROP SCHEMA IF EXISTS auth CASCADE")
        cur.execute("DROP TABLE IF EXISTS public.parent_scheduled_tasks CASCADE")
        cur.execute("DROP TABLE IF EXISTS public.parents CASCADE")
        cur.execute("DROP FUNCTION IF EXISTS cancel_unverified_parent_emails CASCADE")
        
        # create schemas and ables
        cur.execute("CREATE SCHEMA auth")
        cur.execute("""
            CREATE TABLE auth.users (
                id UUID PRIMARY KEY,
                confirmed_at TIMESTAMP WITH TIME ZONE
            )
        """)
        
        cur.execute("""
            CREATE TABLE public.parents (
                uuid UUID PRIMARY KEY,
                supabase_id UUID REFERENCES auth.users(id)
            )
        """)
        
        cur.execute("""
            CREATE TABLE public.parent_scheduled_tasks (
                id SERIAL PRIMARY KEY,
                parent_id UUID REFERENCES public.parents(uuid),
                task_type TEXT,
                completed_at TIMESTAMP WITH TIME ZONE,
                is_cancelled BOOLEAN DEFAULT FALSE
            )
        """)
        
        try:
            cur.execute("CREATE ROLE authenticated")
        except psycopg.errors.DuplicateObject:
            pass

    yield db_connection

def load_sql_file(conn, filepath):
    with open(filepath, 'r') as f:
        sql = f.read()
    with conn.cursor() as cur:
        cur.execute(sql)
