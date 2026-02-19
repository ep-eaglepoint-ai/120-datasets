import { WebSocketServer } from 'ws';
import { WebSocket as WsClient } from 'ws';
import { createServer } from 'http';
import { setupWebSocket, getBroadcastFn, getConnectedClients } from '../repository_after/src/websocket';

/** WebSocket tests: Req-8 (client cleanup), Req-9 (broadcast stringify once) */
describe('websocket', () => {
    let server: ReturnType<typeof createServer>;
    let wss: WebSocketServer;
    let serverPort: number;

    beforeAll((done) => {
        server = createServer((req, res) => res.end());
        wss = setupWebSocket(server);
        server.listen(0, () => {
            const addr = server.address();
            serverPort = typeof addr === 'object' && addr ? addr.port : 0;
            done();
        });
    });

    afterAll((done) => {
        wss.close(() => { server.close(() => done()); });
    });

    /** TC-01 | Req-9: getBroadcastFn returns broadcast function */
    it('getBroadcastFn returns a function', () => {
        expect(typeof getBroadcastFn()).toBe('function');
    });

    /** TC-02 | Req-8: getConnectedClients returns 0 when no clients */
    it('getConnectedClients returns 0 when no clients', () => {
        expect(getConnectedClients()).toBe(0);
    });

    /** TC-03 | Req-8: Client removed from set on close (cleanup) */
    it('removes client from set on close so getConnectedClients returns 0', (done) => {
        const url = 'ws://localhost:' + serverPort + '/ws/events';
        const client = new WsClient(url);
        client.on('open', () => {
            expect(getConnectedClients()).toBe(1);
            client.close();
        });
        client.on('close', () => {
            // Poll until server has removed client from set (close handler may be async)
            const deadline = Date.now() + 2000;
            const check = () => {
                if (getConnectedClients() === 0) {
                    done();
                    return;
                }
                if (Date.now() > deadline) {
                    done(new Error('Expected getConnectedClients() to be 0 within 2s'));
                    return;
                }
                setTimeout(check, 20);
            };
            setTimeout(check, 20);
        });
        client.on('error', done);
    }, 5000);

    /** TC-04 | Req-9: Broadcast stringifies once per event (no repeated JSON.stringify) */
    it('broadcast stringifies once per event', () => {
        const stringifySpy = jest.spyOn(JSON, 'stringify');
        const broadcast = getBroadcastFn();
        const event = {
            event_id: 'e1', device_id: 'd1', sensor_type: 'temp', value: 25, unit: 'C',
            timestamp: '2024-01-01T00:00:00Z', processed_at: new Date(), received_at: new Date(),
        };
        broadcast(event);
        expect(stringifySpy).toHaveBeenCalledTimes(1);
        stringifySpy.mockRestore();
    });
});
