import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { IngestEventSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      )
    }

    const keyHash = createHash('sha256').update(apiKey).digest('hex')
    
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { tenant: true },
    })

    if (!apiKeyRecord || apiKeyRecord.revokedAt) {
      return NextResponse.json(
        { error: 'Invalid or revoked API key' },
        { status: 401 }
      )
    }

    if (!rateLimit(apiKeyRecord.tenantId, 100, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const validatedData = IngestEventSchema.parse(body)

    if (validatedData.tenantId !== apiKeyRecord.tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID mismatch' },
        { status: 403 }
      )
    }

    const timestamp = typeof validatedData.timestamp === 'string'
      ? new Date(validatedData.timestamp)
      : new Date(validatedData.timestamp)

    const event = await prisma.apiEvent.create({
      data: {
        tenantId: validatedData.tenantId,
        timestamp,
        endpoint: validatedData.endpoint,
        method: validatedData.method,
        statusCode: validatedData.statusCode,
        latencyMs: validatedData.latencyMs,
        requestId: validatedData.requestId,
      },
    })

    return NextResponse.json({ success: true, eventId: event.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request body', details: error },
        { status: 400 }
      )
    }
    
    console.error('Ingest error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
