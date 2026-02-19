export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  pollId: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  showResultsBeforeVote: boolean;
  expiresAt?: string;
  isClosed: boolean;
  createdAt: string;
}

export interface CreatePollBody {
  question: string;
  options: string[];
  showResultsBeforeVote: boolean;
  expiresAt?: string;
}

export interface VoteBody {
  optionId: string;
  voteToken?: string;
}
