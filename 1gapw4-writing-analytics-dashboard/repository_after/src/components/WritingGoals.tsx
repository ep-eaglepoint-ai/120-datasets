'use client';

import { useState } from 'react';
import { WritingGoal } from '@/lib/types';

interface WritingGoalsProps {
  goals: WritingGoal[];
  onAddGoal: (goal: Omit<WritingGoal, 'id' | 'createdAt' | 'currentValue' | 'completed'>) => void;
  onUpdateGoal: (id: string, updates: Partial<WritingGoal>) => void;
  onDeleteGoal: (id: string) => void;
  totalWordCount: number;
  avgReadability: number;
  avgSentiment: number;
}

export default function WritingGoals({
  goals,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  totalWordCount,
  avgReadability,
  avgSentiment,
}: WritingGoalsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetMetric: 'wordCount' as const,
    targetValue: 1000,
  });

  const handleAddGoal = () => {
    if (!newGoal.title.trim()) return;
    onAddGoal(newGoal);
    setNewGoal({
      title: '',
      description: '',
      targetMetric: 'wordCount',
      targetValue: 1000,
    });
    setShowAddForm(false);
  };

  const getMetricValue = (metric: string): number => {
    switch (metric) {
      case 'wordCount':
        return totalWordCount;
      case 'readability':
        return avgReadability;
      case 'sentiment':
        return avgSentiment * 100; // Convert to percentage
      case 'consistency':
        return goals.filter(g => g.completed).length / Math.max(goals.length, 1) * 100;
      default:
        return 0;
    }
  };

  const getProgress = (goal: WritingGoal): number => {
    const current = getMetricValue(goal.targetMetric);
    return Math.min(100, (current / goal.targetValue) * 100);
  };

  const formatMetricLabel = (metric: string): string => {
    switch (metric) {
      case 'wordCount':
        return 'Total Words';
      case 'readability':
        return 'Avg Readability';
      case 'sentiment':
        return 'Sentiment Score';
      case 'consistency':
        return 'Consistency';
      default:
        return metric;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>🎯</span> Writing Goals
          <span className="text-sm font-normal text-gray-500">
            ({goals.filter(g => g.completed).length}/{goals.length} completed)
          </span>
        </h3>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Add goal button */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2"
            >
              <span>+</span> Add New Goal
            </button>
          )}

          {/* Add goal form */}
          {showAddForm && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <input
                type="text"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                placeholder="Goal title..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                placeholder="Description (optional)..."
                className="w-full p-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newGoal.targetMetric}
                  onChange={(e) => setNewGoal({ ...newGoal, targetMetric: e.target.value as any })}
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="wordCount">Word Count</option>
                  <option value="readability">Readability</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="consistency">Consistency</option>
                </select>
                <input
                  type="number"
                  value={newGoal.targetValue}
                  onChange={(e) => setNewGoal({ ...newGoal, targetValue: Number(e.target.value) })}
                  placeholder="Target value"
                  className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddGoal}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Create Goal
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Goals list */}
          {goals.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">
              No goals set. Create your first writing goal above.
            </p>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => {
                const progress = getProgress(goal);
                const isCompleted = progress >= 100;

                return (
                  <div
                    key={goal.id}
                    className={`border rounded-lg p-3 ${
                      isCompleted ? 'border-green-300 bg-green-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-800 flex items-center gap-2">
                          {isCompleted && <span>✅</span>}
                          {goal.title}
                        </h4>
                        {goal.description && (
                          <p className="text-xs text-gray-500 mt-1">{goal.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="text-gray-400 hover:text-red-500 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{formatMetricLabel(goal.targetMetric)}</span>
                        <span>
                          {getMetricValue(goal.targetMetric).toFixed(0)} / {goal.targetValue}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isCompleted ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
