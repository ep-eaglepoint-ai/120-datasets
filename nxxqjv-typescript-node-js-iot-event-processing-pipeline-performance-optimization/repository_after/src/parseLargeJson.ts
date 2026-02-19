import { Worker } from 'worker_threads';
import path from 'path';

export function parseLargeJsonInWorker(buffer: Buffer): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(__dirname, 'largePayloadHandler.js');
        const worker = new Worker(workerPath, {
            workerData: { buffer },
        });
        worker.on('message', (msg: { ok: boolean; data?: unknown; error?: string }) => {
            if (msg.ok && msg.data !== undefined) {
                resolve(msg.data);
            } else {
                reject(new Error(msg.error || 'Parse failed'));
            }
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error('Worker stopped with code ' + code));
            }
        });
    });
}
