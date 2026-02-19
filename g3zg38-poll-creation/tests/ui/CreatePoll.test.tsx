/**
 * Requirement 1: Poll creation form.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreatePoll } from '../../repository_after/client/src/pages/CreatePoll';

const mockCreatePoll = jest.fn();
jest.mock('../../repository_after/client/src/api/polls', () => ({
  createPoll: (...args: unknown[]) => mockCreatePoll(...args),
}));

const mockAddCreatedPoll = jest.fn();
jest.mock('../../repository_after/client/src/store/pollStore', () => ({
  usePollStore: (selector: (s: { addCreatedPoll: () => void }) => void) =>
    selector({ addCreatedPoll: mockAddCreatedPoll }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCreatePoll.mockResolvedValue({
    pollId: 'abc123xyz',
    question: 'Test?',
    options: [{ id: 'o1', text: 'A', votes: 0 }, { id: 'o2', text: 'B', votes: 0 }],
    totalVotes: 0,
    showResultsBeforeVote: false,
    isClosed: false,
    createdAt: new Date().toISOString(),
  });
});

function renderCreatePoll() {
  return render(
    <MemoryRouter>
      <CreatePoll />
    </MemoryRouter>
  );
}

describe('CreatePoll - Requirement 1', () => {
  it('shows question input and options', () => {
    renderCreatePoll();
    expect(screen.getByPlaceholderText('Your poll question')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Option 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Option 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
  });

  it('adds option when Add clicked', () => {
    renderCreatePoll();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByPlaceholderText('Option 3')).toBeInTheDocument();
  });

  it('removes option when Remove clicked', () => {
    renderCreatePoll();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    const removeBtns = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeBtns).toHaveLength(3);
    fireEvent.click(removeBtns[2]);
    expect(screen.queryByPlaceholderText('Option 3')).not.toBeInTheDocument();
  });

  it('shows optional expiration and show results toggle', () => {
    renderCreatePoll();
    expect(screen.getByLabelText(/Expiration/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Show results before voting/)).toBeInTheDocument();
  });

  it('validates question required', async () => {
    renderCreatePoll();
    fireEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    await waitFor(() => {
      expect(screen.getByText('Question is required')).toBeInTheDocument();
    });
    expect(mockCreatePoll).not.toHaveBeenCalled();
  });

  it('validates at least 2 options', async () => {
    renderCreatePoll();
    fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('Your poll question'), { target: { value: 'Q?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    await waitFor(() => {
      expect(screen.getByText('At least 2 options are required')).toBeInTheDocument();
    });
    expect(mockCreatePoll).not.toHaveBeenCalled();
  });

  it('submits and shows share link with copy button', async () => {
    renderCreatePoll();
    fireEvent.change(screen.getByPlaceholderText('Your poll question'), { target: { value: 'Best color?' } });
    fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: 'Red' } });
    fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: 'Blue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create poll' }));
    await waitFor(() => {
      expect(mockCreatePoll).toHaveBeenCalledWith({
        question: 'Best color?',
        options: ['Red', 'Blue'],
        showResultsBeforeVote: false,
        expiresAt: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.getByText('Poll created')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    });
    expect(mockAddCreatedPoll).toHaveBeenCalledWith('abc123xyz');
    const shareInput = screen.getByDisplayValue(/\/poll\/abc123xyz$/);
    expect(shareInput).toBeInTheDocument();
  });

  it('disables Add button when 10 options reached', () => {
    renderCreatePoll();
    // Add 8 more options (starting with 2)
    for (let i = 0; i < 8; i++) {
      fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    }
    expect(screen.getAllByPlaceholderText(/Option \d+/)).toHaveLength(10);
    expect(screen.getByRole('button', { name: '+ Add' })).toBeDisabled();
  });

  it('cannot remove options below minimum of 2', () => {
    renderCreatePoll();
    const removeBtns = screen.getAllByRole('button', { name: 'Remove' });
    expect(removeBtns).toHaveLength(2);
    // Both should be disabled since we're at minimum
    expect(removeBtns[0]).toBeDisabled();
    expect(removeBtns[1]).toBeDisabled();
  });
});
