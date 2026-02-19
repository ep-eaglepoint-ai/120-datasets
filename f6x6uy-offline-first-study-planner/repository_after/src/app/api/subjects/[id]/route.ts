/**
 * Individual Subject API Route
 * 
 * GET /api/subjects/[id] - Get a specific subject
 * PUT /api/subjects/[id] - Update a subject
 * DELETE /api/subjects/[id] - Delete a subject
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  getSubjectById,
  updateSubject,
  deleteSubject,
} from '@/services/subjectService';
import { ApiResponse } from '@/types';
import { createErrorResponse, isValidObjectId } from '@/lib/utils';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/subjects/[id]
 * Get a specific subject by ID
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
          error: 'Invalid subject ID format',
        },
        { status: 400 }
      );
    }

    const subject = await getSubjectById(id);

    if (!subject) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subject not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: subject,
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
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
 * PUT /api/subjects/[id]
 * Update a subject
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
          error: 'Invalid subject ID format',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const subject = await updateSubject(id, body);

    return NextResponse.json({
      success: true,
      data: subject,
      message: 'Subject updated successfully',
    });
  } catch (error) {
    console.error('Error updating subject:', error);

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

      if (error.message.includes('already exists')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 409 }
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

/**
 * DELETE /api/subjects/[id]
 * Delete a subject
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
          error: 'Invalid subject ID format',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteSubject(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subject not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Subject deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting subject:', error);
    return NextResponse.json(
      {
        success: false,
        ...createErrorResponse(error),
      },
      { status: 500 }
    );
  }
}
