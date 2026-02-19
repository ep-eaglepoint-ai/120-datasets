/**
 * Requirement 5: Dashboard - list created polls (localStorage), detailed results, close poll.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../repository_after/client/src/pages/Dashboard';

const mockGetPoll = jest.fn();
const mockClosePoll = jest.fn();
jest.mock('../../repository_after/client/src/api/polls', () => ({
  getPoll: (...args: unknown[]) => mockGetPoll(...args),
  closePoll: (...args: unknown[]) => mockClosePoll(...args),
}));

const createdPollIds = ['poll1', 'poll2'];
const mockLoadCreatedPollIds = jest.fn();
const mockDashboardState = {
  createdPollIds,
  loadCreatedPollIds: mockLoadCreatedPollIds,
};
jest.mock('../../repository_after/client/src/store/pollStore', () => ({
  usePollStore: (selector?: (s: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockDashboardState) : mockDashboardState,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPoll.mockImplementation((id: string) =>
    Promise.resolve({
      pollId: id,
      question: 'Poll ' + id,
      options: [{ id: 'o1', text: 'A', votes: 1 }],
      totalVotes: 1,
      showResultsBeforeVote: false,
      isClosed: false,
      createdAt: new Date().toISOString(),
    })
  );
});

describe('Dashboard - Requirement 5', () => {
  it('shows list of created polls with status and total votes', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(mockGetPoll).toHaveBeenCalledWith('poll1');
      expect(mockGetPoll).toHaveBeenCalledWith('poll2');
    });
    await waitFor(() => {
      expect(screen.getByText(/Poll poll1/)).toBeInTheDocument();
      expect(screen.getByText(/Poll poll2/)).toBeInTheDocument();
      expect(screen.getAllByText(/Status:/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Total votes:/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('has View results link for each poll', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      const viewResultsLinks = screen.getAllByRole('link', { name: /View results/ });
      expect(viewResultsLinks.length).toBeGreaterThanOrEqual(1);
      expect(viewResultsLinks[0]).toBeInTheDocument();
    });
  });

  it('has Close poll button for open polls and calls closePoll on click', async () => {
    mockClosePoll.mockResolvedValue({
      pollId: 'poll1',
      question: 'Poll poll1',
      options: [{ id: 'o1', text: 'A', votes: 1 }],
      totalVotes: 1,
      showResultsBeforeVote: false,
      isClosed: true,
      createdAt: new Date().toISOString(),
    });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Poll poll1/)).toBeInTheDocument();
    });
    const closeBtns = screen.getAllByRole('button', { name: /Close poll/ });
    fireEvent.click(closeBtns[0]);
    await waitFor(() => {
      expect(mockClosePoll).toHaveBeenCalledWith('poll1');
    });
  });

  it('hides Close button after poll is closed', async () => {
    mockClosePoll.mockResolvedValue({
      pollId: 'poll1',
      question: 'Poll poll1',
      options: [{ id: 'o1', text: 'A', votes: 1 }],
      totalVotes: 1,
      showResultsBeforeVote: false,
      isClosed: true,
      createdAt: new Date().toISOString(),
    });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Poll poll1/)).toBeInTheDocument();
    });
    // Should have close buttons for open polls
    const closeBtns = screen.getAllByRole('button', { name: /Close poll/ });
    expect(closeBtns.length).toBeGreaterThan(0);
    // Click close on first poll
    fireEvent.click(closeBtns[0]);
    await waitFor(() => {
      expect(mockClosePoll).toHaveBeenCalledWith('poll1');
    });
    // After closing, status should show "Closed" for poll1
    await waitFor(() => {
      expect(screen.getByText(/Status: Closed/)).toBeInTheDocument();
    });
  });

  it('shows Expired status for expired polls', async () => {
    mockGetPoll.mockImplementation((id: string) => {
      if (id === 'poll1') {
        return Promise.resolve({
          pollId: id,
          question: 'Expired poll',
          options: [{ id: 'o1', text: 'A', votes: 0 }],
          totalVotes: 0,
          showResultsBeforeVote: false,
          isClosed: false,
          expiresAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          createdAt: new Date().toISOString(),
        });
      }
      return Promise.resolve({
        pollId: id,
        question: 'Poll ' + id,
        options: [{ id: 'o1', text: 'A', votes: 1 }],
        totalVotes: 1,
        showResultsBeforeVote: false,
        isClosed: false,
        createdAt: new Date().toISOString(),
      });
    });
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Expired poll/)).toBeInTheDocument();
    });
    // Verify "Expired" status is shown
    expect(screen.getByText(/Status: Expired/)).toBeInTheDocument();
  });
});

describe('Dashboard - Empty State', () => {
  it('shows empty state when no polls created', async () => {
    // Temporarily override the mock state
    const emptyMockState = {
      createdPollIds: [],
      loadCreatedPollIds: jest.fn(),
    };
    jest.doMock('../../repository_after/client/src/store/pollStore', () => ({
      usePollStore: (selector?: (s: unknown) => unknown) =>
        typeof selector === 'function' ? selector(emptyMockState) : emptyMockState,
    }));

    // Use a fresh import with the empty state mock
    // For this test, we need to directly modify the mockDashboardState
    mockDashboardState.createdPollIds = [];

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/You have not created any polls yet/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Create one/ })).toBeInTheDocument();

    // Restore for other tests
    mockDashboardState.createdPollIds = createdPollIds;
  });
});
