/**
 * Requirement 2: Short unique URL, voting page without auth, copy-to-clipboard.
 * Requirement 3: Display question and options, select one and submit; localStorage duplicate prevention; confirmation.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VotePoll } from '../../repository_after/client/src/pages/VotePoll';

const mockGetPoll = jest.fn();
const mockVote = jest.fn();
jest.mock('../../repository_after/client/src/api/polls', () => ({
  getPoll: (...args: unknown[]) => mockGetPoll(...args),
  vote: (...args: unknown[]) => mockVote(...args),
}));

const mockSetPoll = jest.fn();
const mockVotePageState: {
  poll: Record<string, unknown> | null;
  setPoll: (p: unknown) => void;
  updatePoll: (p: unknown) => void;
} = {
  poll: null,
  setPoll: mockSetPoll,
  updatePoll: jest.fn(),
};
jest.mock('../../repository_after/client/src/store/pollStore', () => ({
  usePollStore: (selector?: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockVotePageState) : mockVotePageState,
  hasVoted: jest.fn(() => false),
  setVoted: jest.fn(),
  getOrCreateVoteToken: jest.fn(() => 'token-test'),
}));

jest.mock('socket.io-client', () => ({
  io: () => ({
    emit: () => {},
    on: () => {},
    off: () => {},
    close: () => {},
  }),
}));

const pollData = {
  pollId: 'poll123',
  question: 'Best fruit?',
  options: [{ id: 'opt1', text: 'Apple', votes: 0 }, { id: 'opt2', text: 'Banana', votes: 0 }],
  totalVotes: 0,
  showResultsBeforeVote: false,
  isClosed: false,
  createdAt: new Date().toISOString(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVotePageState.poll = null;
  mockSetPoll.mockImplementation((p) => {
    mockVotePageState.poll = p as typeof mockVotePageState.poll;
  });
  mockGetPoll.mockResolvedValue(pollData);
  const store = jest.requireMock('../../repository_after/client/src/store/pollStore');
  store.hasVoted.mockReturnValue(false);
});

describe('VotingPage - Requirement 2', () => {
  it('displays poll question and options and copy link button', async () => {
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });
});

describe('VotingPage - Requirement 3', () => {
  it('allows selecting one option and submitting vote and shows confirmation', async () => {
    const updatedPoll = {
      ...pollData,
      options: [{ id: 'opt1', text: 'Apple', votes: 1 }, { id: 'opt2', text: 'Banana', votes: 0 }],
      totalVotes: 1,
    };
    mockVote.mockResolvedValue(updatedPoll);
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    const appleRadio = screen.getByRole('radio', { name: 'Apple' });
    fireEvent.click(appleRadio);
    fireEvent.click(screen.getByRole('button', { name: 'Submit vote' }));
    await waitFor(() => {
      expect(mockVote).toHaveBeenCalledWith('poll123', 'opt1', 'token-test');
    });
    await waitFor(() => {
      expect(screen.getByText(/Your vote has been recorded/)).toBeInTheDocument();
    });
  });
});

describe('VotingPage - Requirement 3 (showResultsBeforeVote behavior)', () => {
  it('hides results until user votes when showResultsBeforeVote is false', async () => {
    const updatedPoll = {
      ...pollData,
      options: [{ id: 'opt1', text: 'Apple', votes: 1 }, { id: 'opt2', text: 'Banana', votes: 0 }],
      totalVotes: 1,
    };
    mockVote.mockResolvedValue(updatedPoll);
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    // Verify form is shown, not results (no percentage display)
    expect(screen.getByRole('button', { name: 'Submit vote' })).toBeInTheDocument();
    expect(screen.queryByText(/Total participants:/)).not.toBeInTheDocument();

    // Vote
    fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit vote' }));

    // After voting, results should appear
    await waitFor(() => {
      expect(screen.getByText(/Your vote has been recorded/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Total participants:/)).toBeInTheDocument();
  });

  it('shows results before voting when showResultsBeforeVote is true', async () => {
    const pollWithResultsBefore = {
      ...pollData,
      showResultsBeforeVote: true,
      options: [{ id: 'opt1', text: 'Apple', votes: 5 }, { id: 'opt2', text: 'Banana', votes: 3 }],
      totalVotes: 8,
    };
    mockGetPoll.mockResolvedValue(pollWithResultsBefore);
    mockVotePageState.poll = null;
    mockSetPoll.mockImplementation((p) => {
      mockVotePageState.poll = p as typeof mockVotePageState.poll;
    });

    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    // Results should be visible immediately
    await waitFor(() => {
      expect(screen.getByText(/Total participants:/)).toBeInTheDocument();
    });
  });

  it('shows "You have already voted" when user has voted before', async () => {
    const store = jest.requireMock('../../repository_after/client/src/store/pollStore');
    store.hasVoted.mockReturnValue(true);
    const pollWithVotes = {
      ...pollData,
      options: [{ id: 'opt1', text: 'Apple', votes: 5 }, { id: 'opt2', text: 'Banana', votes: 3 }],
      totalVotes: 8,
    };
    mockGetPoll.mockResolvedValue(pollWithVotes);
    mockVotePageState.poll = null;
    mockSetPoll.mockImplementation((p) => {
      mockVotePageState.poll = p as typeof mockVotePageState.poll;
    });

    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    // Verify message and results are shown, not form
    await waitFor(() => {
      expect(screen.getByText('You have already voted.')).toBeInTheDocument();
    });
    expect(screen.getByText(/Total participants:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit vote' })).not.toBeInTheDocument();
  });

  it('prevents duplicate vote submission using localStorage token', async () => {
    const store = jest.requireMock('../../repository_after/client/src/store/pollStore');
    const updatedPoll = {
      ...pollData,
      options: [{ id: 'opt1', text: 'Apple', votes: 1 }, { id: 'opt2', text: 'Banana', votes: 0 }],
      totalVotes: 1,
    };
    mockVote.mockResolvedValue(updatedPoll);
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit vote' }));
    await waitFor(() => {
      expect(store.getOrCreateVoteToken).toHaveBeenCalledWith('poll123');
    });
    expect(mockVote).toHaveBeenCalledWith('poll123', 'opt1', 'token-test');
    await waitFor(() => {
      expect(store.setVoted).toHaveBeenCalledWith('poll123');
    });
  });
});

describe('VotingPage - Error Handling', () => {
  it('displays error message when vote fails', async () => {
    mockVote.mockRejectedValue(new Error('Network error'));
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Best fruit?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Apple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit vote' }));
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('displays error when poll fails to load', async () => {
    mockGetPoll.mockRejectedValue(new Error('Poll not found'));
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Poll not found')).toBeInTheDocument();
    });
  });

  it('displays "Poll expired" when poll has expired (GET returns 410)', async () => {
    mockGetPoll.mockRejectedValue(new Error('Poll expired'));
    render(
      <MemoryRouter initialEntries={['/poll/poll123']}>
        <Routes>
          <Route path="/poll/:pollId" element={<VotePoll />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Poll expired')).toBeInTheDocument();
    });
  });
});
