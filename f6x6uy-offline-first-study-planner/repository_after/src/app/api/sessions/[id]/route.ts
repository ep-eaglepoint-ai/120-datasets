/**
 * Individual Study Session API Route
 * 
 * GET /api/sessions/[id] - Get a specific study session
 * PUT /api/sessions/[id] - Update a study session
 * DELETE /api/sessions/[id] - Delete a study session
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  getStudySessionById,
  updateStudySession,
  deleteStudySession,
} from '@/services/studySessionService';
import { ApiResponse } from '@/types';
import { createErrorResponse, isValidObjectId } from '@/lib/utils';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/sessions/[id]
 * Get a specific study session by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session ID format',
        },
        { status: 400 }
      );
    }

    const session = await getStudySessionById(id);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Study session not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error fetching study session:', error);
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
 * PUT /api/sessions/[id]
 * Update a study session
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session ID format',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const session = await updateStudySession(id, body);

    return NextResponse.json({
      success: true,
      data: session,
      message: 'Study session updated successfully',
    });
  } catch (error) {
    console.error('Error updating study session:', error);

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

    if (error instanceof Error && error.message === 'Study session not found') {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
      );
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

/**
 * DELETE /api/sessions/[id]
 * Delete a study session
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session ID format',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteStudySession(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Study session not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Study session deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting study session:', error);
    return NextResponse.json(
      {
        success: false,
        ...createErrorResponse(error),
      },
      { status: 500 }
    );
  }
}
