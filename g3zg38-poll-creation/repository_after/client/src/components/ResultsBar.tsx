import type { PollOption } from '../types';

interface ResultsBarProps {
  option: PollOption;
  totalVotes: number;
  isLeading: boolean;
}

/** Req 4 & 6: horizontal bar chart, percentage, leading highlight, animated progress */
export function ResultsBar({ option, totalVotes, isLeading }: ResultsBarProps) {
  const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className={isLeading ? 'font-semibold text-indigo-600' : ''}>{option.text}</span>
        <span>
          {option.votes} vote{option.votes !== 1 ? 's' : ''} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out bg-indigo-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: isLeading ? '#4f46e5' : '#6366f1',
          }}
        />
      </div>
    </div>
  );
}
