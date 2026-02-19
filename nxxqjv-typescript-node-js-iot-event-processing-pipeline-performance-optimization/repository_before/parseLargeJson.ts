export function parseLargeJsonInWorker(buffer: Buffer): Promise<unknown> {
    return Promise.resolve(JSON.parse(buffer.toString('utf8')));
}
