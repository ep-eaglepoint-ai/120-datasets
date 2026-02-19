import type { Poll } from '../types';
import { ResultsBar } from './ResultsBar';

interface ResultsSummaryProps {
  poll: Poll;
}

/** Req 4 & 6: vote counts, percentages, horizontal bars, total participants, leading highlight */
export function ResultsSummary({ poll }: ResultsSummaryProps) {
  const total = poll.totalVotes;
  const maxVotes = Math.max(...poll.options.map((o) => o.votes), 0);
  const leadingIds = total > 0 ? poll.options.filter((o) => o.votes === maxVotes).map((o) => o.id) : [];

  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">
        Total participants: <strong>{total}</strong>
      </p>
      <div className="space-y-2">
        {poll.options.map((opt) => (
          <ResultsBar
            key={opt.id}
            option={opt}
            totalVotes={total}
            isLeading={leadingIds.includes(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}
