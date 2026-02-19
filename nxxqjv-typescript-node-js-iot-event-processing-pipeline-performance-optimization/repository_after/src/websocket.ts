import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { ProcessedEvent } from './types';

const clients: Set<WebSocket> = new Set();

function cleanupClient(ws: WebSocket): void {
    clients.delete(ws);
}

function broadcastEvent(event: ProcessedEvent): void {
    const payload = JSON.stringify({ type: 'event', data: event });
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

export function setupWebSocket(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws/events' });

    wss.on('connection', (ws: WebSocket) => {
        if (process.env.NODE_ENV !== 'test') {
            console.log('New WebSocket client connected');
        }
        clients.add(ws);

        ws.on('message', (message: string) => {
            if (process.env.NODE_ENV !== 'test') {
                console.log('Received:', message);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            cleanupClient(ws);
        });

        ws.on('close', () => {
            cleanupClient(ws);
        });
    });

    return wss;
}

export function getBroadcastFn(): (event: ProcessedEvent) => void {
    return broadcastEvent;
}

export function getConnectedClients(): number {
    return clients.size;
}

export function closeWebSocketServer(wss: WebSocketServer | null): Promise<void> {
    if (!wss) return Promise.resolve();
    clients.clear();
    return new Promise((resolve) => {
        wss.close(() => resolve());
    });
}
