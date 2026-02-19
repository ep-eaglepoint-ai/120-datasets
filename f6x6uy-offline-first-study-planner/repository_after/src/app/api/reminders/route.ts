/**
 * Reminders API Route
 *
 * GET /api/reminders - List reminders
 * POST /api/reminders - Create a reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createReminder, getAllReminders } from '@/services/reminderService';
import { ApiResponse } from '@/types';
import { createErrorResponse } from '@/lib/utils';

/**
 * GET /api/reminders
 * List reminders with optional filters
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');
    const subjectId = searchParams.get('subjectId') || undefined;
    const upcoming = searchParams.get('upcoming') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const sortBy = (searchParams.get('sortBy') as 'triggerTime' | 'createdAt') || 'triggerTime';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';

    const reminders = await getAllReminders({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      subjectId,
      upcoming,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json(
      {
        success: false,
        ...createErrorResponse(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reminders
 * Create a new reminder
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const reminder = await createReminder(body);

    return NextResponse.json(
      {
        success: true,
        data: reminder,
        message: 'Reminder created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating reminder:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: error.flatten().fieldErrors as Record<string, string[]>,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === 'Subject not found') {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        ...createErrorResponse(error),
      },
      { status: 500 }
    );
  }
}
