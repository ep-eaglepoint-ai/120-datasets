import { Server } from 'http';
import { WebSocketServer } from 'ws';

export type ShutdownHandles = {
    server: Server;
    wss: WebSocketServer | null;
};

let isShuttingDown = false;

export function isShutdownInProgress(): boolean {
    return isShuttingDown;
}

export function resetShutdownState(): void {
    isShuttingDown = false;
}

export async function gracefulShutdown(handles: ShutdownHandles): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('Shutting down...');
    process.exit(0);
}
