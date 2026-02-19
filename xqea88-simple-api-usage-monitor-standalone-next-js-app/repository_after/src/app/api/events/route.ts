import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EventsQuerySchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const queryParams = {
      tenantId: searchParams.get('tenantId') || '',
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      endpoint: searchParams.get('endpoint') || undefined,
      statusGroup: searchParams.get('statusGroup') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '50',
    }

    const validatedQuery = EventsQuerySchema.parse(queryParams)

    if (session.user.role !== 'ADMIN' && validatedQuery.tenantId !== session.user.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const where: any = { tenantId: validatedQuery.tenantId }
    
    if (validatedQuery.from || validatedQuery.to) {
      where.timestamp = {}
      if (validatedQuery.from) {
        where.timestamp.gte = new Date(validatedQuery.from)
      }
      if (validatedQuery.to) {
        where.timestamp.lte = new Date(validatedQuery.to)
      }
    }

    if (validatedQuery.endpoint) {
      where.endpoint = { contains: validatedQuery.endpoint }
    }

    if (validatedQuery.statusGroup) {
      const statusMap: Record<string, { gte: number; lt: number }> = {
        '2xx': { gte: 200, lt: 300 },
        '4xx': { gte: 400, lt: 500 },
        '5xx': { gte: 500, lt: 600 },
      }
      const range = statusMap[validatedQuery.statusGroup]
      where.statusCode = range
    }

    if (validatedQuery.search) {
      where.OR = [
        { endpoint: { contains: validatedQuery.search } },
        { requestId: { contains: validatedQuery.search } },
      ]
    }

    const page = parseInt(validatedQuery.page || '1')
    const pageSize = parseInt(validatedQuery.pageSize || '50')
    const skip = (page - 1) * pageSize

    const [events, total] = await Promise.all([
      prisma.apiEvent.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.apiEvent.count({ where }),
    ])

    return NextResponse.json({
      events,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('Events error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
