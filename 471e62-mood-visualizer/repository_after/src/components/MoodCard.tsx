import { MoodShape } from '../lib/types';
import { ShapeCanvas } from './ShapeCanvas';

interface MoodCardProps {
  moodShape: MoodShape;
}

export function MoodCard({ moodShape }: MoodCardProps) {
  const date = new Date(moodShape.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 hover-lift border border-slate-200 transition-all duration-300 group">
      <div className="flex justify-center mb-4 relative">
        <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-slate-100 transition-all duration-300">
          <ShapeCanvas properties={moodShape.properties} width={200} height={200} />
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-slate-800 mb-2 truncate text-lg group-hover:text-slate-900 transition-colors" title={moodShape.mood}>
          {moodShape.mood}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <p>{date}</p>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex justify-center gap-3 text-xs">
            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold capitalize">
              {moodShape.properties.type}
            </span>
            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full font-semibold capitalize">
              {moodShape.properties.animation}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
