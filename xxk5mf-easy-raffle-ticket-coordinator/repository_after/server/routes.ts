import { Router, Request, Response } from 'express';
import { purchaseTickets, getRaffleState, drawWinner } from './raffleService';
import { requireAdmin } from './adminAuth';

const router = Router();

router.post('/purchase', async (req: Request, res: Response) => {
  const userId = req.body?.userId;
  const quantity = req.body?.quantity;
  if (typeof userId !== 'string' || !userId.trim()) {
    res.status(400).json({ success: false, error: 'Invalid request' });
    return;
  }
  const result = await purchaseTickets(userId.trim(), typeof quantity === 'number' ? quantity : 1);
  if (result.success) {
    res.status(200).json(result);
  } else {
    const status = result.error === 'Raffle Closed' ? 400 : result.error === 'Sold Out' || result.error === 'Limit Reached' ? 409 : 400;
    res.status(status).json(result);
  }
});

router.get('/raffle/state', async (req: Request, res: Response) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const state = await getRaffleState(userId || null);
  res.json(state);
});

router.post('/admin/draw-winner', requireAdmin, async (_req: Request, res: Response) => {
  const result = await drawWinner();
  if (result.success) {
    res.status(200).json({ success: true, winningTicketId: result.winningTicketId });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
});

export default router;
