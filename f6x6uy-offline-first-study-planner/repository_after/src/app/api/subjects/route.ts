/**
 * Subjects API Route
 * 
 * GET /api/subjects - List all subjects
 * POST /api/subjects - Create a new subject
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createSubject, getAllSubjects } from '@/services/subjectService';
import { ApiResponse } from '@/types';
import { createErrorResponse } from '@/lib/utils';

/**
 * GET /api/subjects
 * List all subjects with optional pagination and sorting
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const sortBy = (searchParams.get('sortBy') as 'name' | 'createdAt' | 'updatedAt') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    const subjects = await getAllSubjects({ page, limit, sortBy, sortOrder });

    return NextResponse.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
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
 * POST /api/subjects
 * Create a new subject
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    const body = await request.json();
    const subject = await createSubject(body);

    return NextResponse.json(
      {
        success: true,
        data: subject,
        message: 'Subject created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating subject:', error);

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

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 409 }
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
