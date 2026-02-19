/**
 * Study Sessions API Route
 * 
 * GET /api/sessions - List all study sessions
 * POST /api/sessions - Create a new study session
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createStudySession, getAllStudySessions } from '@/services/studySessionService';
import { ApiResponse } from '@/types';
import { createErrorResponse } from '@/lib/utils';

/**
 * GET /api/sessions
 * List all study sessions with optional filters
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subjectId = searchParams.get('subjectId') || undefined;
    const startDate = searchParams.get('startDate') 
      ? new Date(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!) 
      : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const sortBy = (searchParams.get('sortBy') as 'timestamp' | 'duration' | 'createdAt') || 'timestamp';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const sessions = await getAllStudySessions({
      subjectId,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Error fetching study sessions:', error);
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
 * POST /api/sessions
 * Create a new study session
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const session = await createStudySession(body);

    return NextResponse.json(
      {
        success: true,
        data: session,
        message: 'Study session created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating study session:', error);

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

      if (error.message.includes('Duplicate session submission')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 429 }
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
