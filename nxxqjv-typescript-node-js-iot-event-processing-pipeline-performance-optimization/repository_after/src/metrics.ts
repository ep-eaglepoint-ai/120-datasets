/**
 * In-memory metrics for monitoring.
 */

const WINDOW_MS = 60_000;

let totalReceived = 0;
let totalProcessed = 0;
let totalFailed = 0;
const processedTimestamps: number[] = [];

export function incrementReceived(count: number): void {
    totalReceived += count;
}

export function incrementProcessed(count: number): void {
    totalProcessed += count;
    const now = Date.now();
    for (let i = 0; i < count; i++) processedTimestamps.push(now);
    const cutoff = now - WINDOW_MS;
    while (processedTimestamps.length > 0 && processedTimestamps[0] < cutoff) {
        processedTimestamps.shift();
    }
}

export function incrementFailed(count: number): void {
    totalFailed += count;
}

export function getTotalReceived(): number {
    return totalReceived;
}

export function getTotalProcessed(): number {
    return totalProcessed;
}

export function getTotalFailed(): number {
    return totalFailed;
}

export function getEventsPerSecond(): number {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const inWindow = processedTimestamps.filter((t) => t >= cutoff).length;
    return WINDOW_MS > 0 ? (inWindow / WINDOW_MS) * 1000 : 0;
}

export function getMemoryUsageMb(): number {
    const usage = process.memoryUsage();
    return Math.round((usage.heapUsed ?? 0) / 1024 / 1024);
}

export function resetMetrics(): void {
    totalReceived = 0;
    totalProcessed = 0;
    totalFailed = 0;
    processedTimestamps.length = 0;
}
