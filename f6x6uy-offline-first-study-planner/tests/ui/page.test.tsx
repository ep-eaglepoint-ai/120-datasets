/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

const mockCacheData = jest.fn();
const mockGetCachedData = jest.fn();
const mockAddToSyncQueue = jest.fn();
const mockProcessSyncQueue = jest.fn().mockResolvedValue(undefined);

jest.mock('../../repository_after/src/lib/offline-manager', () => ({
  OfflineManager: {
    KEYS: {
      PENDING_SESSIONS: 'study_planner_pending_sessions',
      PENDING_SUBJECTS: 'study_planner_pending_subjects',
      CACHED_STATS: 'study_planner_cached_stats',
      CACHED_SUBJECTS: 'study_planner_cached_subjects',
    },
    cacheData: (...args: unknown[]) => mockCacheData(...args),
    getCachedData: (...args: unknown[]) => mockGetCachedData(...args),
    addToSyncQueue: (...args: unknown[]) => mockAddToSyncQueue(...args),
    processSyncQueue: () => mockProcessSyncQueue(),
  },
}));

const minimalDashboardStats = {
  totalSubjects: 0,
  totalStudyTime: 0,
  totalSessions: 0,
  todayStudyTime: 0,
  todaySessions: 0,
  weekStudyTime: 0,
  weekSessions: 0,
  monthStudyTime: 0,
  monthSessions: 0,
  streak: {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    streakHistory: [],
  },
  recentSessions: [],
  topSubjects: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCachedData.mockReturnValue(null);
  Object.defineProperty(global.navigator, 'onLine', {
    value: true,
    writable: true,
    configurable: true,
  });
  global.fetch = jest.fn((url: string) => {
    if (url.includes('/api/analytics')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: minimalDashboardStats }),
      } as Response);
    }
    if (url.includes('/api/subjects')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [{ id: '507f1f77bcf86cd799439011', name: 'Math', createdAt: '', updatedAt: '' }],
          }),
      } as Response);
    }
    return Promise.reject(new Error('Unknown URL'));
  }) as jest.Mock;
});

async function renderPage() {
  const HomePage = (await import('../../repository_after/src/app/page')).default;
  return render(<HomePage />);
}

describe('Page: render and loading', () => {
  it('renders without crashing', async () => {
    const { container } = await renderPage();
    await screen.findByRole('heading', { name: /Study Planner/i });
    expect(container).toBeInTheDocument();
  });

  it('shows loading then content when fetch succeeds', async () => {
    await renderPage();
    expect(screen.getByText(/Loading your study dashboard/i)).toBeInTheDocument();
    await screen.findByRole('heading', { name: /Study Planner/i });
    expect(screen.queryByText(/Loading your study dashboard/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Track your learning journey/i)).toBeInTheDocument();
  });
});

describe('Page: error and cache fallback', () => {
  it('shows error when fetch fails and no cache', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    mockGetCachedData.mockReturnValue(null);
    await renderPage();
    await screen.findByText(/Error/i);
    expect(screen.getByText(/Failed to connect to server/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('shows cached data when fetch fails and cache exists', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    mockGetCachedData.mockImplementation((key: string) => {
      if (key === 'study_planner_cached_stats') return minimalDashboardStats;
      return null;
    });
    await renderPage();
    await screen.findByRole('heading', { name: /Study Planner/i });
    expect(screen.getByText(/Total Study Time/i)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to connect to server/i)).not.toBeInTheDocument();
  });
});

describe('Page: offline submit path', () => {
  it('calls addToSyncQueue for session when logging while offline', async () => {
    await renderPage();
    await screen.findByRole('heading', { name: /Study Planner/i });
    Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
    window.alert = jest.fn();
    const logButton = screen.getByRole('button', { name: /Log Session/i });
    fireEvent.click(logButton);
    await waitFor(() => {
      expect(screen.getByText(/Log Study Session/i)).toBeInTheDocument();
    });
    const subjectSelect = document.querySelector('select[name="subjectId"]') as HTMLSelectElement;
    const durationInput = document.querySelector('input[name="duration"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Save Session/i });
    expect(subjectSelect).toBeTruthy();
    expect(durationInput).toBeTruthy();
    fireEvent.change(subjectSelect, { target: { value: '507f1f77bcf86cd799439011' } });
    fireEvent.change(durationInput, { target: { value: '30' } });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        'study_planner_pending_sessions',
        expect.objectContaining({
          duration: 1800,
          subjectId: '507f1f77bcf86cd799439011',
        })
      );
    });
  });

  it('calls addToSyncQueue for subject when adding subject while offline', async () => {
    await renderPage();
    await screen.findByRole('heading', { name: /Study Planner/i });
    Object.defineProperty(global.navigator, 'onLine', { value: false, writable: true, configurable: true });
    window.alert = jest.fn();
    const addSubjectButton = screen.getByRole('button', { name: /Subject/i });
    fireEvent.click(addSubjectButton);
    await waitFor(() => {
      expect(screen.getByText(/Add New Subject/i)).toBeInTheDocument();
    });
    const nameInput = document.querySelector('input[name="name"]') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /Add Subject/i });
    expect(nameInput).toBeTruthy();
    fireEvent.change(nameInput, { target: { value: 'Physics' } });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockAddToSyncQueue).toHaveBeenCalledWith(
        'study_planner_pending_subjects',
        expect.objectContaining({ name: 'Physics' })
      );
    });
  });
});
