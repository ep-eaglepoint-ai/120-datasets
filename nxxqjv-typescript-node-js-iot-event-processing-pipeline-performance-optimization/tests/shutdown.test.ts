const mockRemoveProcessedEventsListener = jest.fn();
const mockGetBroadcastFn = jest.fn();
const mockGetWorker = jest.fn();
const mockWorkerClose = jest.fn().mockResolvedValue(undefined);
const mockEventQueueClose = jest.fn().mockResolvedValue(undefined);
const mockCloseWebSocketServer = jest.fn().mockResolvedValue(undefined);
const mockClosePool = jest.fn().mockResolvedValue(undefined);

jest.mock('../repository_after/src/queue', () => ({
    getWorker: () => mockGetWorker(),
    eventQueue: { close: () => mockEventQueueClose() },
    removeProcessedEventsListener: (fn: () => void) => mockRemoveProcessedEventsListener(fn),
}));
jest.mock('../repository_after/src/websocket', () => ({
    closeWebSocketServer: (wss: unknown) => mockCloseWebSocketServer(wss),
    getBroadcastFn: () => mockGetBroadcastFn(),
}));
jest.mock('../repository_after/src/database', () => ({
    closePool: () => mockClosePool(),
}));

import { createServer } from 'http';
import { gracefulShutdown, isShutdownInProgress, resetShutdownState, ShutdownHandles } from '../repository_after/src/shutdown';

/** Graceful shutdown tests: Req-10 (coordinated shutdown order) */
describe('shutdown', () => {
    let server: ReturnType<typeof createServer>;
    let exitSpy: jest.SpyInstance;

    beforeAll(() => {
        // process.exit(code?: string | number | null) => never; mock must accept same param type
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((((_code?: string | number | null) => {}) as (code?: string | number | null | undefined) => never));
    });

    afterAll(() => {
        exitSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetWorker.mockReturnValue({ close: mockWorkerClose });
        mockGetBroadcastFn.mockReturnValue(() => {});
        server = createServer((_req, res) => res.end());
        resetShutdownState();
    });

    afterEach((done) => {
        if (server.listening) {
            server.close(() => done());
        } else {
            done();
        }
    });

    /** TC-01 | Req-10: Close server then worker, queue, wss, pool in order */
    it('closes server then worker, queue, wss, pool in order', async () => {
        await new Promise<void>((resolve, reject) => {
            server.listen(0, () => resolve());
            server.on('error', reject);
        });
        const wss = { close: jest.fn().mockImplementation((cb: () => void) => cb()) } as unknown as import('ws').WebSocketServer;
        const handles: ShutdownHandles = { server, wss };

        await gracefulShutdown(handles);

        expect(mockRemoveProcessedEventsListener).toHaveBeenCalled();
        expect(mockWorkerClose).toHaveBeenCalled();
        expect(mockEventQueueClose).toHaveBeenCalled();
        expect(mockCloseWebSocketServer).toHaveBeenCalledWith(wss);
        expect(mockClosePool).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
    });

    /** TC-02 | Req-10: isShutdownInProgress returns true after shutdown started */
    it('isShutdownInProgress returns true after shutdown started', async () => {
        await new Promise<void>((resolve, reject) => {
            server.listen(0, () => resolve());
            server.on('error', reject);
        });
        const handles: ShutdownHandles = { server, wss: null };
        expect(isShutdownInProgress()).toBe(false);
        const p = gracefulShutdown(handles);
        await Promise.resolve();
        expect(isShutdownInProgress()).toBe(true);
        await p;
    });
});
