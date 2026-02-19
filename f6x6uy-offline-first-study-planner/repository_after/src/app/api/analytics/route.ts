/**
 * Analytics API Route
 * 
 * GET /api/analytics/dashboard - Get dashboard statistics
 * GET /api/analytics/streak - Get study streak information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardStats, calculateStudyStreak } from '@/services/analyticsService';
import { ApiResponse } from '@/types';
import { createErrorResponse } from '@/lib/utils';

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard statistics
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const endpoint = searchParams.get('endpoint');

    if (endpoint === 'streak') {
      const streak = await calculateStudyStreak();
      return NextResponse.json({
        success: true,
        data: streak,
      });
    }

    // Default: return full dashboard stats
    const stats = await getDashboardStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        success: false,
        ...createErrorResponse(error),
      },
      { status: 500 }
    );
  }
}
