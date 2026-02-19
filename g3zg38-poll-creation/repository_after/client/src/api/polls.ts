import type { Poll, CreatePollInput } from '../types';

const API_BASE = '/api';

export async function createPoll(input: CreatePollInput): Promise<Poll> {
  const res = await fetch(`${API_BASE}/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create poll');
  }
  return res.json();
}

export async function getPoll(pollId: string): Promise<Poll> {
  const res = await fetch(`${API_BASE}/polls/${pollId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch poll');
  }
  return res.json();
}

export async function vote(pollId: string, optionId: string, voteToken: string): Promise<Poll> {
  const res = await fetch(`${API_BASE}/polls/${pollId}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Vote-Token': voteToken,
    },
    body: JSON.stringify({ optionId, voteToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to vote');
  }
  return res.json();
}

export async function closePoll(pollId: string): Promise<Poll> {
  const res = await fetch(`${API_BASE}/polls/${pollId}/close`, { method: 'PATCH' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to close poll');
  }
  return res.json();
}
