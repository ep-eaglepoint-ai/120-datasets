import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MoodCard } from '../components/MoodCard';
import { storageManager } from '../lib/storageManager';
import { MoodShape } from '../lib/types';

export function GalleryPage() {
  const [moods, setMoods] = useState<MoodShape[]>([]);

  useEffect(() => {
    // Load saved moods on mount
    const savedMoods = storageManager.loadAll();
    // Sort by timestamp descending (newest first)
    const sorted = savedMoods.sort((a, b) => b.timestamp - a.timestamp);
    setMoods(sorted);
  }, []);

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all saved moods?')) {
      storageManager.clear();
      setMoods([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
        <div className="absolute top-40 right-10 w-64 h-64 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
        <div className="absolute -bottom-8 left-1/2 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="text-center mb-12 animate-slide-in">
          <h1 className="text-5xl font-bold text-slate-900 mb-4 drop-shadow-sm">Your Mood Gallery</h1>
          <div className="inline-block px-6 py-2 bg-white rounded-full shadow-md border border-slate-200">
            <p className="text-lg text-slate-700 font-semibold">
              {moods.length} {moods.length === 1 ? 'mood' : 'moods'} saved
            </p>
          </div>
        </header>

        <div className="flex justify-center gap-4 mb-10 flex-wrap">
          <Link
            to="/"
            className="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
          >
            ← Create New Mood
          </Link>
          
          {moods.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
            >
              Clear All
            </button>
          )}
        </div>

        {moods.length === 0 ? (
          <div className="text-center py-20 animate-scale-in">
            <div className="inline-block p-8 bg-white rounded-2xl shadow-lg border border-slate-200">
              <p className="text-2xl text-slate-700 font-bold mb-6">No moods saved yet!</p>
              <Link
                to="/"
                className="inline-block px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              >
                Create your first mood →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {moods.map((mood, index) => (
              <div
                key={mood.id}
                className="animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <MoodCard moodShape={mood} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
