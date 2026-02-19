import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { eventEmitter } from './queue';
import { ProcessedEvent } from './types';

const clients: Set<WebSocket> = new Set();

export function setupWebSocket(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: '/ws/events' });

    wss.on('connection', (ws: WebSocket) => {
        console.log('New WebSocket client connected');
        clients.add(ws);

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        ws.on('message', (message: string) => {
            console.log('Received:', message);
        });
    });

    eventEmitter.on('event_processed', (event: ProcessedEvent) => {
        broadcastEvent(event);
    });

    return wss;
}

function broadcastEvent(event: ProcessedEvent): void {
    const payload = JSON.stringify({ type: 'event', data: event });
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

export function getBroadcastFn(): (event: ProcessedEvent) => void {
    return broadcastEvent;
}

export function closeWebSocketServer(wss: WebSocketServer | null): Promise<void> {
    if (!wss) return Promise.resolve();
    return new Promise((resolve) => {
        wss.close(() => resolve());
    });
}

export function getConnectedClients(): number {
    return clients.size;
}
