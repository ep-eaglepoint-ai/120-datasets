export interface SensorEvent {
    event_id: string;
    device_id: string;
    sensor_type: string;
    value: number;
    unit: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface ProcessedEvent extends SensorEvent {
    processed_at: Date;
    received_at: Date;
}

export interface BatchPayload {
    events: SensorEvent[];
}

export interface EventStats {
    total_received: number;
    total_processed: number;
    total_failed: number;
    queue_depth: number;
    events_per_second: number;
}

