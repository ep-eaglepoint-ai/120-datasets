import { create } from 'zustand';
import type { Poll } from '../types';

const CREATED_POLLS_KEY = 'poll_creation_created_polls';

function getCreatedPollIds(): string[] {
  try {
    const raw = localStorage.getItem(CREATED_POLLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addCreatedPollId(pollId: string): void {
  const ids = getCreatedPollIds();
  if (ids.includes(pollId)) return;
  localStorage.setItem(CREATED_POLLS_KEY, JSON.stringify([...ids, pollId]));
}

export function hasVoted(pollId: string): boolean {
  return localStorage.getItem(`voted_poll_${pollId}`) === '1';
}

export function setVoted(pollId: string): void {
  localStorage.setItem(`voted_poll_${pollId}`, '1');
}

export function getOrCreateVoteToken(pollId: string): string {
  const key = `vote_token_${pollId}`;
  let token = localStorage.getItem(key);
  if (!token) {
    token = `vt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, token);
  }
  return token;
}

interface PollState {
  poll: Poll | null;
  setPoll: (p: Poll | null) => void;
  updatePoll: (p: Poll) => void;
  createdPollIds: string[];
  addCreatedPoll: (pollId: string) => void;
  loadCreatedPollIds: () => void;
}

export const usePollStore = create<PollState>((set) => ({
  poll: null,
  setPoll: (poll) => set({ poll }),
  updatePoll: (poll) => set((s) => (s.poll?.pollId === poll.pollId ? { poll } : s)),
  createdPollIds: getCreatedPollIds(),
  addCreatedPoll: (pollId) => {
    addCreatedPollId(pollId);
    set({ createdPollIds: getCreatedPollIds() });
  },
  loadCreatedPollIds: () => set({ createdPollIds: getCreatedPollIds() }),
}));
