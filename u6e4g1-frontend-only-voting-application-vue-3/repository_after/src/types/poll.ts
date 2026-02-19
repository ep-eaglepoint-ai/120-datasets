export type PollVotingMode = "single" | "multi";

export type PollStatus = "active" | "closed" | "expired";

export type PollOption = {
  id: string;
  text: string;
};

export type Ballot = {
  id: string;
  pollId: string;
  optionIds: string[];
  voterName?: string;
  createdAt: number;
};

export type Poll = {
  id: string;
  title: string;
  description?: string;
  tags: string[];

  votingMode: PollVotingMode;
  isAnonymous: boolean;

  startAt?: number;
  endAt?: number;
  closedManuallyAt?: number;

  options: PollOption[];
  ballots: Ballot[];

  createdAt: number;
  updatedAt: number;
  lastVoteAt?: number;
};
