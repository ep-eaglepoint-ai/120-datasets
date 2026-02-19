import { useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { MoodInput } from '../components/MoodInput';
import { ShapeCanvas } from '../components/ShapeCanvas';
import { moodToShape } from '../lib/moodToShape';
import { storageManager } from '../lib/storageManager';
import { MoodShape } from '../lib/types';

export function HomePage() {
  const [currentMood, setCurrentMood] = useState<MoodShape | null>(null);
  const [saved, setSaved] = useState(false);

  const handleMoodSubmit = (mood: string) => {
    try {
      const properties = moodToShape(mood);
      const moodShape: MoodShape = {
        id: uuidv4(),
        mood,
        timestamp: Date.now(),
        properties,
      };
      setCurrentMood(moodShape);
      setSaved(false);
    } catch (error) {
      console.error('Error generating shape:', error);
    }
  };

  const handleSave = () => {
    if (currentMood) {
      storageManager.save(currentMood);
      setSaved(true);
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
          <h1 className="text-6xl font-bold text-slate-900 mb-4 drop-shadow-sm">
            MoodMorph
          </h1>
          <p className="text-lg text-slate-600 font-medium">Visualize your mood as animated shapes</p>
        </header>

        <div className="flex flex-col items-center gap-8">
          <div className="animate-scale-in">
            <MoodInput onSubmit={handleMoodSubmit} />
          </div>

          {currentMood && (
            <div className="bg-white rounded-2xl shadow-xl p-8 text-center animate-scale-in hover-lift border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Your Mood:
              </h2>
              <p className="text-xl text-slate-600 font-semibold mb-6 italic">
                "{currentMood.mood}"
              </p>
              
              <div className="mb-8 flex justify-center">
                <div className="p-6 rounded-2xl bg-slate-50">
                  <ShapeCanvas properties={currentMood.properties} />
                </div>
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <button
                  onClick={handleSave}
                  disabled={saved}
                  className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] ${
                    saved
                      ? 'bg-emerald-600 text-white cursor-not-allowed shadow-md'
                      : 'bg-slate-800 hover:bg-slate-900 text-white shadow-md hover:shadow-lg'
                  }`}
                >
                  {saved ? '✓ Saved!' : 'Save to Gallery'}
                </button>

                <Link
                  to="/gallery"
                  className="px-8 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
                >
                  View Gallery
                </Link>
              </div>

              <div className="mt-8 p-4 bg-slate-50 rounded-xl">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-slate-500 font-medium">Shape</p>
                    <p className="text-slate-800 font-bold text-lg capitalize">{currentMood.properties.type}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 font-medium">Animation</p>
                    <p className="text-slate-800 font-bold text-lg capitalize">{currentMood.properties.animation}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 font-medium">Pattern</p>
                    <p className="text-slate-800 font-bold text-lg capitalize">{currentMood.properties.pattern}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!currentMood && (
            <div className="text-center animate-slide-in">
              <Link
                to="/gallery"
                className="inline-block px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] shadow-md hover:shadow-lg"
              >
                View your saved moods →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
