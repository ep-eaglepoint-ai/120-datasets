/**
 * Requirement 4: Vote counts and percentages, horizontal bar charts, real-time Socket.IO, highlight leading.
 * Requirement 6: Animated progress bars, total participants, clean summary view.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResultsBar } from '../../repository_after/client/src/components/ResultsBar';
import { ResultsSummary } from '../../repository_after/client/src/components/ResultsSummary';
import type { Poll } from '../../repository_after/client/src/types';

describe('ResultsBar - Requirement 4 and 6', () => {
  it('shows option text, vote count and percentage', () => {
    render(
      <ResultsBar
        option={{ id: 'o1', text: 'Red', votes: 3 }}
        totalVotes={10}
        isLeading={false}
      />
    );
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText(/3 vote/)).toBeInTheDocument();
    expect(screen.getByText(/30\.0%/)).toBeInTheDocument();
  });

  it('applies leading highlight when isLeading', () => {
    render(
      <ResultsBar
        option={{ id: 'o1', text: 'Blue', votes: 5 }}
        totalVotes={5}
        isLeading={true}
      />
    );
    const leadingText = screen.getByText('Blue');
    expect(leadingText).toHaveClass('font-semibold');
    expect(leadingText).toHaveClass('text-indigo-600');
  });

  it('renders progress bar with width percentage', () => {
    const { container } = render(
      <ResultsBar
        option={{ id: 'o1', text: 'A', votes: 1 }}
        totalVotes={4}
        isLeading={false}
      />
    );
    const bar = container.querySelector('.transition-all');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveStyle({ width: '25%' });
  });

  it('has animation transition classes for smooth progress bar', () => {
    const { container } = render(
      <ResultsBar
        option={{ id: 'o1', text: 'A', votes: 2 }}
        totalVotes={4}
        isLeading={false}
      />
    );
    const bar = container.querySelector('.transition-all');
    expect(bar).toHaveClass('duration-500');
    expect(bar).toHaveClass('ease-out');
  });

  it('calculates 0% when totalVotes is 0', () => {
    const { container } = render(
      <ResultsBar
        option={{ id: 'o1', text: 'A', votes: 0 }}
        totalVotes={0}
        isLeading={false}
      />
    );
    const bar = container.querySelector('.transition-all');
    expect(bar).toHaveStyle({ width: '0%' });
  });

  it('displays singular "vote" for 1 vote', () => {
    render(
      <ResultsBar
        option={{ id: 'o1', text: 'Single', votes: 1 }}
        totalVotes={1}
        isLeading={true}
      />
    );
    expect(screen.getByText(/1 vote \(/)).toBeInTheDocument();
  });

  it('displays plural "votes" for multiple votes', () => {
    render(
      <ResultsBar
        option={{ id: 'o1', text: 'Multiple', votes: 5 }}
        totalVotes={10}
        isLeading={false}
      />
    );
    expect(screen.getByText(/5 votes \(/)).toBeInTheDocument();
  });
});

describe('ResultsSummary - Requirement 4 and 6', () => {
  it('shows total participants and all options with bars', () => {
    const poll: Poll = {
      pollId: 'p1',
      question: 'Q?',
      options: [
        { id: 'o1', text: 'A', votes: 2 },
        { id: 'o2', text: 'B', votes: 3 },
      ],
      totalVotes: 5,
      showResultsBeforeVote: true,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    render(<ResultsSummary poll={poll} />);
    expect(screen.getByText(/Total participants:/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('highlights the leading option correctly', () => {
    const poll: Poll = {
      pollId: 'p1',
      question: 'Q?',
      options: [
        { id: 'o1', text: 'Winner', votes: 10 },
        { id: 'o2', text: 'Loser', votes: 3 },
      ],
      totalVotes: 13,
      showResultsBeforeVote: true,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    render(<ResultsSummary poll={poll} />);
    const winnerText = screen.getByText('Winner');
    expect(winnerText).toHaveClass('font-semibold');
    expect(winnerText).toHaveClass('text-indigo-600');
    const loserText = screen.getByText('Loser');
    expect(loserText).not.toHaveClass('font-semibold');
  });

  it('handles tied options by highlighting all leaders', () => {
    const poll: Poll = {
      pollId: 'p1',
      question: 'Q?',
      options: [
        { id: 'o1', text: 'TiedA', votes: 5 },
        { id: 'o2', text: 'TiedB', votes: 5 },
        { id: 'o3', text: 'Behind', votes: 2 },
      ],
      totalVotes: 12,
      showResultsBeforeVote: true,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    render(<ResultsSummary poll={poll} />);
    const tiedA = screen.getByText('TiedA');
    const tiedB = screen.getByText('TiedB');
    const behind = screen.getByText('Behind');
    expect(tiedA).toHaveClass('font-semibold');
    expect(tiedB).toHaveClass('font-semibold');
    expect(behind).not.toHaveClass('font-semibold');
  });

  it('displays zero participants correctly', () => {
    const poll: Poll = {
      pollId: 'p1',
      question: 'Q?',
      options: [
        { id: 'o1', text: 'A', votes: 0 },
        { id: 'o2', text: 'B', votes: 0 },
      ],
      totalVotes: 0,
      showResultsBeforeVote: true,
      isClosed: false,
      createdAt: new Date().toISOString(),
    };
    render(<ResultsSummary poll={poll} />);
    expect(screen.getByText(/Total participants:/)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
