import { Server } from 'http';
import { WebSocketServer } from 'ws';
import { closePool } from './database';
import { closeWebSocketServer } from './websocket';
import { getWorker, eventQueue, removeProcessedEventsListener } from './queue';
import { getBroadcastFn } from './websocket';

const SHUTDOWN_TIMEOUT_MS = 60_000;

export type ShutdownHandles = {
    server: Server;
    wss: WebSocketServer | null;
};

let isShuttingDown = false;

export function isShutdownInProgress(): boolean {
    return isShuttingDown;
}

/** For tests only: reset shutdown state so isShutdownInProgress() can be false again. */
export function resetShutdownState(): void {
    isShuttingDown = false;
}

export async function gracefulShutdown(handles: ShutdownHandles): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    const timeout = setTimeout(() => {
        console.error('Graceful shutdown timeout; forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
        console.log('Shutting down: stopping HTTP server from accepting new connections...');
        if (handles.server.listening) {
            await new Promise<void>((resolve, reject) => {
                handles.server.close((err) => (err ? reject(err) : resolve()));
            });
        }

        removeProcessedEventsListener(getBroadcastFn());

        const worker = getWorker();
        if (worker) {
            console.log('Closing queue worker...');
            await worker.close();
        }
        await eventQueue.close();

        if (handles.wss) {
            console.log('Closing WebSocket server...');
            await closeWebSocketServer(handles.wss);
        }

        console.log('Closing database pool...');
        await closePool();

        clearTimeout(timeout);
        isShuttingDown = false;
        process.exit(0);
    } catch (err) {
        console.error('Shutdown error:', err);
        isShuttingDown = false;
        clearTimeout(timeout);
        process.exit(1);
    }
}
