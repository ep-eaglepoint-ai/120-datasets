/**
 * Individual Reminder API Route
 *
 * GET /api/reminders/[id] - Get a reminder
 * PATCH /api/reminders/[id] - Update a reminder
 * DELETE /api/reminders/[id] - Delete a reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  getReminderById,
  updateReminder,
  deleteReminder,
} from '@/services/reminderService';
import { ApiResponse } from '@/types';
import { createErrorResponse, isValidObjectId } from '@/lib/utils';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/reminders/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminder ID format' },
        { status: 400 }
      );
    }

    const reminder = await getReminderById(id);

    if (!reminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error('Error fetching reminder:', error);
    return NextResponse.json(
      { success: false, ...createErrorResponse(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reminders/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminder ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const reminder = await updateReminder(id, body);

    return NextResponse.json({
      success: true,
      data: reminder,
      message: 'Reminder updated successfully',
    });
  } catch (error) {
    console.error('Error updating reminder:', error);

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

    if (error instanceof Error && error.message === 'Reminder not found') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, ...createErrorResponse(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse>> {
  try {
    const { id } = params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminder ID format' },
        { status: 400 }
      );
    }

    const deleted = await deleteReminder(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    return NextResponse.json(
      { success: false, ...createErrorResponse(error) },
      { status: 500 }
    );
  }
}
