/**
 * Analytics Service
 * 
 * Business logic for calculating study statistics, streaks, and progress analytics.
 * Handles complex aggregations and time-based calculations.
 */

import { getDatabase } from '@/lib/db';
import { StudySession } from '@/types';
import {
  StudyStatistics,
  SubjectStudyBreakdown,
  DailyStudySummary,
  WeeklyStudySummary,
  MonthlyStudySummary,
  StudyStreak,
  StreakPeriod,
  DashboardStats,
} from '@/types';
import {
  getDateString,
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getStartOfMonth,
  getDaysDifference,
  isSameDay,
  getDateRange,
  sum,
  average,
  sortByDesc,
} from '@/lib/utils';
import { getAllStudySessions, getStudyTimeBySubject } from './studySessionService';
import { getAllSubjects } from './subjectService';

const COLLECTION_NAME = 'study_sessions';

// ============================================================================
// Study Statistics
// ============================================================================

/**
 * Get study statistics for a date range
 * 
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns Study statistics with subject breakdown
 */
export async function getStudyStatistics(
  startDate?: Date,
  endDate?: Date
): Promise<StudyStatistics> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  // Build query filter
  const filter: Record<string, unknown> = {};
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      (filter.timestamp as Record<string, unknown>).$gte = startDate;
    }
    if (endDate) {
      (filter.timestamp as Record<string, unknown>).$lte = endDate;
    }
  }

  // Aggregate by subject
  const result = await collection.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$subjectId',
        totalTime: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
      },
    },
  ]).toArray();

  const totalStudyTime = sum(result.map(r => r.totalTime));
  const sessionCount = sum(result.map(r => r.sessionCount));
  const averageSessionDuration = sessionCount > 0 ? totalStudyTime / sessionCount : 0;

  // Get subject names
  const subjectIds = result.map(r => r._id.toString());
  const subjects = await getAllSubjects();
  const subjectMap = new Map(subjects.map(s => [s.id, s.name]));

  // Build subject breakdown
  const subjectBreakdown: SubjectStudyBreakdown[] = result.map(item => ({
    subjectId: item._id.toString(),
    subjectName: subjectMap.get(item._id.toString()) || 'Unknown Subject',
    totalTime: item.totalTime,
    sessionCount: item.sessionCount,
    percentage: totalStudyTime > 0 ? (item.totalTime / totalStudyTime) * 100 : 0,
  }));

  // Sort by total time descending
  subjectBreakdown.sort((a, b) => b.totalTime - a.totalTime);

  return {
    totalStudyTime,
    sessionCount,
    averageSessionDuration: Math.round(averageSessionDuration),
    subjectBreakdown,
  };
}

// ============================================================================
// Daily, Weekly, Monthly Summaries
// ============================================================================

/**
 * Get daily study summary for a specific date
 * 
 * @param date - Date to get summary for
 * @returns Daily study summary
 */
export async function getDailySummary(date: Date): Promise<DailyStudySummary> {
  const startOfDay = getStartOfDay(date);
  const endOfDay = getEndOfDay(date);

  const sessions = await getAllStudySessions({
    startDate: startOfDay,
    endDate: endOfDay,
    limit: 10000, // High limit to get all sessions for the day
  });

  const totalStudyTime = sum(sessions.map(s => s.duration));
  const sessionCount = sessions.length;
  const subjectsStudied = [...new Set(sessions.map(s => s.subjectId))];

  return {
    date: getDateString(date),
    totalStudyTime,
    sessionCount,
    subjectsStudied,
  };
}

/**
 * Get weekly study summary
 * 
 * @param date - Any date within the week
 * @returns Weekly study summary with daily breakdowns
 */
export async function getWeeklySummary(date: Date): Promise<WeeklyStudySummary> {
  const weekStart = getStartOfWeek(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  // Get all days in the week
  const days = getDateRange(weekStart, weekEnd);
  const dailySummaries = await Promise.all(
    days.map(day => getDailySummary(day))
  );

  const totalStudyTime = sum(dailySummaries.map(d => d.totalStudyTime));
  const sessionCount = sum(dailySummaries.map(d => d.sessionCount));

  return {
    weekStart: getDateString(weekStart),
    weekEnd: getDateString(weekEnd),
    totalStudyTime,
    sessionCount,
    dailySummaries,
  };
}

/**
 * Get monthly study summary
 * 
 * @param year - Year
 * @param month - Month (1-12)
 * @returns Monthly study summary with weekly breakdowns
 */
export async function getMonthlySummary(year: number, month: number): Promise<MonthlyStudySummary> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  // Get all weeks in the month
  const weeks: Date[] = [];
  let currentWeekStart = getStartOfWeek(monthStart);
  
  while (currentWeekStart <= monthEnd) {
    weeks.push(new Date(currentWeekStart));
    currentWeekStart.setUTCDate(currentWeekStart.getUTCDate() + 7);
  }

  const weeklySummaries = await Promise.all(
    weeks.map(week => getWeeklySummary(week))
  );

  const totalStudyTime = sum(weeklySummaries.map(w => w.totalStudyTime));
  const sessionCount = sum(weeklySummaries.map(w => w.sessionCount));

  return {
    month: `${year}-${String(month).padStart(2, '0')}`,
    totalStudyTime,
    sessionCount,
    weeklySummaries,
  };
}

// ============================================================================
// Study Streaks
// ============================================================================

/**
 * Calculate study streaks based on consecutive days with sessions
 * 
 * @returns Study streak information
 */
export async function calculateStudyStreak(): Promise<StudyStreak> {
  const db = await getDatabase();
  const collection = db.collection<StudySession>(COLLECTION_NAME);

  // Get all sessions sorted by timestamp
  const sessions = await collection
    .find({})
    .sort({ timestamp: 1 })
    .toArray();

  if (sessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      streakHistory: [],
    };
  }

  // Get unique study dates
  const studyDates = [...new Set(sessions.map(s => getDateString(s.timestamp)))];
  studyDates.sort();

  // Convert to Date objects
  const studyDateObjects = studyDates.map(dateStr => new Date(dateStr + 'T00:00:00.000Z'));

  // Calculate streaks
  const streakPeriods: StreakPeriod[] = [];
  let currentStreakStart = studyDateObjects[0];
  let currentStreakEnd = studyDateObjects[0];

  for (let i = 1; i < studyDateObjects.length; i++) {
    const prevDate = studyDateObjects[i - 1];
    const currDate = studyDateObjects[i];
    const daysDiff = getDaysDifference(prevDate, currDate);

    if (daysDiff === 1) {
      // Consecutive day - extend current streak
      currentStreakEnd = currDate;
    } else {
      // Gap detected - save current streak and start new one
      const streakLength = getDaysDifference(currentStreakStart, currentStreakEnd) + 1;
      streakPeriods.push({
        startDate: getDateString(currentStreakStart),
        endDate: getDateString(currentStreakEnd),
        length: streakLength,
      });
      currentStreakStart = currDate;
      currentStreakEnd = currDate;
    }
  }

  // Add the last streak
  const lastStreakLength = getDaysDifference(currentStreakStart, currentStreakEnd) + 1;
  streakPeriods.push({
    startDate: getDateString(currentStreakStart),
    endDate: getDateString(currentStreakEnd),
    length: lastStreakLength,
  });

  // Find longest streak
  const longestStreak = Math.max(...streakPeriods.map(p => p.length));

  // Calculate current streak
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const lastStudyDate = studyDateObjects[studyDateObjects.length - 1];
  const lastStudyDateStr = getDateString(lastStudyDate);

  let currentStreak = 0;
  if (isSameDay(lastStudyDate, today) || isSameDay(lastStudyDate, yesterday)) {
    // Current streak is active
    currentStreak = streakPeriods[streakPeriods.length - 1].length;
  }

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: lastStudyDateStr,
    streakHistory: streakPeriods,
  };
}

// ============================================================================
// Dashboard Statistics
// ============================================================================

/**
 * Get comprehensive dashboard statistics
 * 
 * @returns Dashboard stats with all key metrics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const today = getStartOfDay(now);
  const todayEnd = getEndOfDay(now);
  
  const weekStart = getStartOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  
  const monthStart = getStartOfMonth(now);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  monthEnd.setUTCDate(0);
  monthEnd.setUTCHours(23, 59, 59, 999);

  // Get all subjects
  const subjects = await getAllSubjects();
  const totalSubjects = subjects.length;

  // Get overall statistics
  const overallStats = await getStudyStatistics();
  const totalStudyTime = overallStats.totalStudyTime;
  const totalSessions = overallStats.sessionCount;

  // Get today's statistics
  const todayStats = await getStudyStatistics(today, todayEnd);
  const todayStudyTime = todayStats.totalStudyTime;
  const todaySessions = todayStats.sessionCount;

  // Get week's statistics
  const weekStats = await getStudyStatistics(weekStart, weekEnd);
  const weekStudyTime = weekStats.totalStudyTime;
  const weekSessions = weekStats.sessionCount;

  // Get month's statistics
  const monthStats = await getStudyStatistics(monthStart, monthEnd);
  const monthStudyTime = monthStats.totalStudyTime;
  const monthSessions = monthStats.sessionCount;

  // Get streak information
  const streak = await calculateStudyStreak();

  // Get recent sessions (last 10)
  const recentSessions = await getAllStudySessions({
    limit: 10,
    sortBy: 'timestamp',
    sortOrder: 'desc',
  });

  // Get top subjects (by study time)
  const topSubjects = overallStats.subjectBreakdown.slice(0, 5);

  return {
    totalSubjects,
    totalStudyTime,
    totalSessions,
    todayStudyTime,
    todaySessions,
    weekStudyTime,
    weekSessions,
    monthStudyTime,
    monthSessions,
    streak,
    recentSessions,
    topSubjects,
  };
}
