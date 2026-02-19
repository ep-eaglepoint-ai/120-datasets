import { parentPort, workerData } from 'worker_threads';

if (parentPort && workerData?.buffer) {
    const str = (workerData.buffer as Buffer).toString('utf8');
    try {
        const parsed = JSON.parse(str);
        parentPort!.postMessage({ ok: true, data: parsed });
    } catch (err) {
        parentPort!.postMessage({ ok: false, error: (err as Error).message });
    }
}
