'use client';

import { useEffect, useState } from 'react';
import { DashboardStats, SubjectResponse, CreateStudySessionInput, CreateSubjectInput } from '@/types';
import { OfflineManager } from '@/lib/offline-manager';

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  
  // UI States
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    fetchDashboardStats();
    fetchSubjects();
    
    const handleOnline = () => {
      setIsOffline(false);
      OfflineManager.processSyncQueue().then(() => {
        fetchDashboardStats();
        fetchSubjects();
      });
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    // Initial sync attempt if online
    if (navigator.onLine) {
      OfflineManager.processSyncQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await fetch('/api/subjects');
      const data = await response.json();
      if (data.success) {
        setSubjects(data.data);
        OfflineManager.cacheData(OfflineManager.KEYS.CACHED_SUBJECTS, data.data);
      }
    } catch (err) {
      const cached = OfflineManager.getCachedData<SubjectResponse[]>(OfflineManager.KEYS.CACHED_SUBJECTS);
      if (cached) setSubjects(cached);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      setLoading(stats ? false : true);
      const response = await fetch('/api/analytics');
      const data = await response.json();

      if (data.success) {
        setStats(data.data);
        OfflineManager.cacheData(OfflineManager.KEYS.CACHED_STATS, data.data);
      } else {
        if (!stats) setError(data.error || 'Failed to load dashboard');
      }
    } catch (err) {
      const cached = OfflineManager.getCachedData<DashboardStats>(OfflineManager.KEYS.CACHED_STATS);
      if (cached) {
        setStats(cached);
      } else if (!stats) {
        setError('Failed to connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: CreateStudySessionInput = {
      subjectId: formData.get('subjectId') as string,
      duration: parseInt(formData.get('duration') as string) * 60, // UI is in minutes
      timestamp: new Date(),
      notes: formData.get('notes') as string || undefined,
    };

    setIsSubmitting(true);
    try {
      if (!navigator.onLine) {
        OfflineManager.addToSyncQueue(OfflineManager.KEYS.PENDING_SESSIONS, payload);
        alert('Saved locally. Will sync when online.');
        setShowSessionModal(false);
        return;
      }

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardStats();
        setShowSessionModal(false);
      } else {
        alert(data.error || 'Failed to log session');
      }
    } catch (error) {
      OfflineManager.addToSyncQueue(OfflineManager.KEYS.PENDING_SESSIONS, payload);
      alert('Network error. Saved locally for later sync.');
      setShowSessionModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: CreateSubjectInput = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
    };

    setIsSubmitting(true);
    try {
      if (!navigator.onLine) {
        OfflineManager.addToSyncQueue(OfflineManager.KEYS.PENDING_SUBJECTS, payload);
        alert('Subject saved locally.');
        setShowSubjectModal(false);
        return;
      }

      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.success) {
        fetchSubjects();
        setShowSubjectModal(false);
      } else {
        alert(data.error || 'Failed to add subject');
      }
    } catch (error) {
      OfflineManager.addToSyncQueue(OfflineManager.KEYS.PENDING_SUBJECTS, payload);
      alert('Saved locally.');
      setShowSubjectModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ width: '40px', height: '40px' }}></div>
          <p className="text-slate-400">Loading your study dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button onClick={fetchDashboardStats} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 animate-fade-in flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                Study Planner
              </h1>
              {isOffline && (
                <span className="px-2 py-1 rounded bg-slate-800 text-orange-400 text-xs font-bold border border-orange-400/30 animate-pulse">
                  OFFLINE MODE
                </span>
              )}
            </div>
            <p className="text-slate-400">Track your learning journey, maintain streaks, and achieve your goals</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSubjectModal(true)} className="btn btn-secondary flex items-center gap-2">
              <span>＋</span> Subject
            </button>
            <button onClick={() => setShowSessionModal(true)} className="btn btn-primary flex items-center gap-2">
              <span>⏱</span> Log Session
            </button>
          </div>
        </header>

        {/* Sync Status Banner */}
        {isOffline && (
          <div className="mb-6 p-4 rounded-xl bg-orange-400/10 border border-orange-400/20 text-orange-400 text-sm animate-slide-up flex items-center gap-3">
            <span className="text-lg">📡</span>
            <div>
              <strong>Working Offline:</strong> Your progress is being saved to your device. 
              We'll sync everything automatically when you're back online.
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          {/* Total Study Time */}
          <div className="card">
            <div className="text-sm text-slate-400 mb-1">Total Study Time</div>
            <div className="text-3xl font-bold text-primary-400">
              {stats ? formatDuration(stats.totalStudyTime) : '0m'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.totalSessions || 0} sessions
            </div>
          </div>

          {/* Current Streak */}
          <div className="card">
            <div className="text-sm text-slate-400 mb-1">Current Streak</div>
            <div className="text-3xl font-bold text-orange-400">
              {stats?.streak.currentStreak || 0} days
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Longest: {stats?.streak.longestStreak || 0} days
            </div>
          </div>

          {/* Today's Progress */}
          <div className="card">
            <div className="text-sm text-slate-400 mb-1">Today</div>
            <div className="text-3xl font-bold text-green-400">
              {stats ? formatDuration(stats.todayStudyTime) : '0m'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {stats?.todaySessions || 0} sessions
            </div>
          </div>

          {/* Total Subjects */}
          <div className="card">
            <div className="text-sm text-slate-400 mb-1">Active Subjects</div>
            <div className="text-3xl font-bold text-purple-400">
              {stats?.totalSubjects || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Learning areas
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="card mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl font-bold mb-4">Recent Sessions</h2>
          {stats && stats.recentSessions.length > 0 ? (
            <div className="space-y-3">
              {stats.recentSessions.slice(0, 5).map((session: any) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-200">
                      {session.subjectName || 'Unknown Subject'}
                    </div>
                    <div className="text-sm text-slate-400">
                      {new Date(session.timestamp).toLocaleDateString()} at{' '}
                      {new Date(session.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary-400">
                      {formatDuration(session.duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📚</div>
              <div className="empty-state-text">No study sessions yet</div>
              <div className="empty-state-subtext">Start logging your study time to see your progress</div>
            </div>
          )}
        </div>

        {/* Top Subjects */}
        <div className="card animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl font-bold mb-4">Top Subjects</h2>
          {stats && stats.topSubjects.length > 0 ? (
            <div className="space-y-3">
              {stats.topSubjects.map((subject: any, index: number) => (
                <div key={subject.subjectId} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-slate-200">{subject.subjectName}</div>
                    <div className="text-sm text-slate-400">
                      {subject.sessionCount} sessions
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-primary-400">
                      {formatDuration(subject.totalTime)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {subject.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🎯</div>
              <div className="empty-state-text">No subjects yet</div>
              <div className="empty-state-subtext">Create subjects to organize your study sessions</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500">
          <p>Offline-First Study Planner • Data automatically syncs when online</p>
        </footer>
      </div>

      {/* Log Session Modal */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md animate-slide-up">
            <h2 className="text-2xl font-bold mb-6 text-primary-400">Log Study Session</h2>
            <form onSubmit={handleLogSession} className="space-y-4">
              <div>
                <label className="label">Subject</label>
                <select name="subjectId" className="input" required defaultValue="">
                  <option value="" disabled>Select a subject</option>
                  {subjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input name="duration" type="number" min="1" max="1440" className="input" placeholder="e.g. 60" required />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea name="notes" className="input min-h-[100px]" placeholder="What did you study?"></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowSessionModal(false)} className="btn btn-secondary flex-1" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject Modal */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="card w-full max-w-md animate-slide-up">
            <h2 className="text-2xl font-bold mb-6 text-purple-400">Add New Subject</h2>
            <form onSubmit={handleAddSubject} className="space-y-4">
              <div>
                <label className="label">Subject Name</label>
                <input name="name" type="text" maxLength={100} className="input" placeholder="e.g. Mathematics" required />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <textarea name="description" className="input min-h-[100px]" placeholder="Brief context about what you're learning"></textarea>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowSubjectModal(false)} className="btn btn-secondary flex-1" disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" style={{ background: '#a855f7' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Add Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
