import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const optionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const pollSchema = new mongoose.Schema({
  pollId: { type: String, required: true, unique: true },
  question: { type: String, required: true },
  options: [optionSchema],
  totalVotes: { type: Number, default: 0 },
  showResultsBeforeVote: { type: Boolean, default: false },
  expiresAt: { type: Date, required: false },
  isClosed: { type: Boolean, default: false },
  votedTokens: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export const PollModel = mongoose.model('Poll', pollSchema);

export function generatePollId(): string {
  return nanoid(10);
}

export function createOptionId(): string {
  return nanoid(8);
}
