export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'events',
        max: 20,
    },
    queue: {
        name: process.env.QUEUE_NAME || 'event-processing',
        concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '20', 10),
        backpressureThreshold: parseInt(process.env.QUEUE_BACKPRESSURE_THRESHOLD || '10000', 10),
    },
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
    largePayloadThresholdBytes: parseInt(process.env.LARGE_PAYLOAD_THRESHOLD_BYTES || '1048576', 10), // 1MB
    maxEventsPerBatch: parseInt(process.env.MAX_EVENTS_PER_BATCH || '10000', 10),
};
