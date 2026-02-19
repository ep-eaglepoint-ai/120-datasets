

CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    processed_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL
);
