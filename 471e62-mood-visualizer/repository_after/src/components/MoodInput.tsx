import { useState } from 'react';
import { ErrorMessage } from './ErrorMessage';

interface MoodInputProps {
  onSubmit: (mood: string) => void;
}

export function MoodInput({ onSubmit }: MoodInputProps) {
  const [mood, setMood] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood.trim()) {
      setError('Mood cannot be empty');
      return;
    }
    setError('');
    onSubmit(mood);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMood(e.target.value);
    if (error) setError('');
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <label htmlFor="mood-input" className="block text-lg font-bold text-slate-800 mb-3 text-center">
            How are you feeling?
          </label>
          <input
            id="mood-input"
            type="text"
            value={mood}
            onChange={handleChange}
            placeholder="happy, sad, anxious, calm..."
            maxLength={100}
            className="w-full px-5 py-4 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-400 focus:border-slate-500 transition-all duration-300 text-lg font-medium bg-white text-gray-900 placeholder:text-gray-400 hover:bg-slate-50"
          />
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2 text-center">
              Examples: happy, excited, sad, anxious, peaceful, angry, calm
            </p>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500 font-medium">
                {mood.length}/100 characters
              </p>
              {mood.length > 0 && (
                <span className="text-slate-600 font-bold">
                  {mood.length >= 80 ? '⚠️' : '✓'}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <ErrorMessage message={error} />
        
        <button
          type="submit"
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-6 rounded-xl text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-xl"
        >
          Generate Shape
        </button>
      </form>
    </div>
  );
}
