import express from 'express';
import request from 'supertest';
import { requestTimeoutMiddleware } from '../repository_after/src/timeoutMiddleware';

/** Request timeout middleware tests: Req-14 (504 Gateway Timeout for hanging requests) */
describe('requestTimeoutMiddleware', () => {
    /** TC-01 | Req-14: Return 504 Gateway Timeout when request exceeds timeout */
    it('returns 504 Gateway Timeout when request exceeds timeout', async () => {
        const timeoutMs = 150;
        const app = express();
        app.use(requestTimeoutMiddleware(timeoutMs));
        app.get('/hang', (_req, _res) => {
            /* never responds */
        });

        const res = await request(app).get('/hang');
        expect(res.status).toBe(504);
        expect(res.body.error).toBe('Gateway Timeout');
    }, 5000);

    /** TC-02 | Req-14: Do not send 504 when response finishes before timeout */
    it('does not send 504 when response finishes before timeout', async () => {
        const timeoutMs = 10_000;
        const app = express();
        app.use(requestTimeoutMiddleware(timeoutMs));
        app.get('/ok', (_req, res) => {
            res.json({ ok: true });
        });

        const res = await request(app).get('/ok');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
