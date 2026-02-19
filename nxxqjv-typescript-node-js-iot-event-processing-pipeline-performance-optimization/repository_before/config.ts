export const config = {
    port: parseInt(String(process.env.PORT || '3000'), 10),
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(String(process.env.REDIS_PORT || '6379'), 10),
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(String(process.env.DB_PORT || '5432'), 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'events',
        max: parseInt(String(process.env.DB_POOL_MAX || '20'), 10),
    },
    queue: {
        name: process.env.QUEUE_NAME || 'event-processing',
        concurrency: parseInt(String(process.env.QUEUE_CONCURRENCY || '5'), 10),
        backpressureThreshold: parseInt(String(process.env.QUEUE_BACKPRESSURE_THRESHOLD || '100000'), 10),
    },
};

