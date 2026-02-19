import { Router, Request, Response } from 'express';
import { PollModel, generatePollId, createOptionId } from '../models/Poll';

const router = Router();

// POST /api/polls - Create poll (Req 1, 2: short unique URL with nanoid)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { question, options, showResultsBeforeVote, expiresAt } = req.body;
    if (!question || !Array.isArray(options)) {
      return res.status(400).json({ error: 'question and options (array) required' });
    }
    if (options.length < 2 || options.length > 10) {
      return res.status(400).json({ error: 'options must be between 2 and 10' });
    }
    const trimmed = options.map((o: string) => String(o).trim()).filter(Boolean);
    if (trimmed.length < 2) {
      return res.status(400).json({ error: 'at least 2 non-empty options required' });
    }
    const trimmedQuestion = String(question).trim();
    if (!trimmedQuestion) {
      return res.status(400).json({ error: 'question is required' });
    }
    const pollId = generatePollId();
    const pollOptions = trimmed.map((text: string) => ({
      id: createOptionId(),
      text,
      votes: 0,
    }));
    const doc = await PollModel.create({
      pollId,
      question: trimmedQuestion,
      options: pollOptions,
      totalVotes: 0,
      showResultsBeforeVote: Boolean(showResultsBeforeVote),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      isClosed: false,
    });
    const poll = doc.toObject();
    const serialized = {
      ...poll,
      _id: undefined,
      __v: undefined,
      votedTokens: undefined,
      createdAt: poll.createdAt?.toISOString?.(),
      expiresAt: poll.expiresAt?.toISOString?.(),
    };
    return res.status(201).json(serialized);
  } catch {
    return res.status(500).json({ error: 'Failed to create poll' });
  }
});

// GET /api/polls/:pollId - Get poll (Req 2: voting page without auth)
router.get('/:pollId', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const doc = await PollModel.findOne({ pollId }).lean();
    if (!doc) return res.status(404).json({ error: 'Poll not found' });
    const poll = doc as Record<string, unknown>;
    if (poll.expiresAt && new Date(poll.expiresAt as string) < new Date()) {
      return res.status(410).json({ error: 'Poll expired' });
    }
    const serialized = {
      pollId: poll.pollId,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
      showResultsBeforeVote: poll.showResultsBeforeVote,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt as string).toISOString() : undefined,
      isClosed: poll.isClosed,
      createdAt: poll.createdAt ? new Date(poll.createdAt as Date).toISOString() : undefined,
    };
    return res.json(serialized);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

// POST /api/polls/:pollId/vote - Vote (Req 3: submit vote; duplicate prevention via voteToken)
router.post('/:pollId/vote', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const { optionId, voteToken } = req.body;
    if (!optionId) return res.status(400).json({ error: 'optionId required' });
    const doc = await PollModel.findOne({ pollId });
    if (!doc) return res.status(404).json({ error: 'Poll not found' });
    if (doc.isClosed) return res.status(410).json({ error: 'Poll is closed' });
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Poll expired' });
    }
    const token = voteToken || req.headers['x-vote-token'];
    if (token && doc.votedTokens?.includes(String(token))) {
      return res.status(409).json({ error: 'Already voted' });
    }
    const option = doc.options.find((o: { id: string }) => o.id === optionId);
    if (!option) return res.status(400).json({ error: 'Invalid optionId' });
    option.votes += 1;
    doc.totalVotes += 1;
    if (token) {
      doc.votedTokens = doc.votedTokens || [];
      doc.votedTokens.push(String(token));
    }
    await doc.save();
    const poll = doc.toObject();
    const serialized = {
      pollId: poll.pollId,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
      showResultsBeforeVote: poll.showResultsBeforeVote,
      expiresAt: poll.expiresAt?.toISOString?.() ?? undefined,
      isClosed: poll.isClosed,
      createdAt: poll.createdAt?.toISOString?.() ?? undefined,
    };
    (req as Request & { io?: { to: (room: string) => { emit: (ev: string, data: unknown) => void } } }).io?.to(pollId).emit('poll-updated', serialized);
    return res.json(serialized);
  } catch {
    return res.status(500).json({ error: 'Failed to record vote' });
  }
});

// PATCH /api/polls/:pollId/close - Close poll (Req 5: close early)
router.patch('/:pollId/close', async (req: Request, res: Response) => {
  try {
    const { pollId } = req.params;
    const doc = await PollModel.findOneAndUpdate(
      { pollId },
      { isClosed: true },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ error: 'Poll not found' });
    const poll = doc as Record<string, unknown>;
    const serialized = {
      pollId: poll.pollId,
      question: poll.question,
      options: poll.options,
      totalVotes: poll.totalVotes,
      showResultsBeforeVote: poll.showResultsBeforeVote,
      expiresAt: poll.expiresAt ? new Date(poll.expiresAt as string).toISOString() : undefined,
      isClosed: true,
      createdAt: poll.createdAt ? new Date(poll.createdAt as Date).toISOString() : undefined,
    };
    (req as Request & { io?: { to: (room: string) => { emit: (ev: string, data: unknown) => void } } }).io?.to(pollId).emit('poll-updated', serialized);
    return res.json(serialized);
  } catch {
    return res.status(500).json({ error: 'Failed to close poll' });
  }
});

export default router;
