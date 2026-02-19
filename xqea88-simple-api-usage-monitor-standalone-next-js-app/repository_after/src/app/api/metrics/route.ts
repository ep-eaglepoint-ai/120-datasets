import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MetricsQuerySchema } from '@/lib/validation'

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
    }

    const validatedQuery = MetricsQuerySchema.parse(queryParams)

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

    const events = await prisma.apiEvent.findMany({ where })

    const total = events.length
    const status2xx = events.filter(e => e.statusCode >= 200 && e.statusCode < 300).length
    const status4xx = events.filter(e => e.statusCode >= 400 && e.statusCode < 500).length
    const status5xx = events.filter(e => e.statusCode >= 500).length
    
    const errorRate = total > 0 ? ((status4xx + status5xx) / total) * 100 : 0

    const sortedLatencies = events.map(e => e.latencyMs).sort((a, b) => a - b)
    const p50Index = Math.floor(sortedLatencies.length * 0.5)
    const p95Index = Math.floor(sortedLatencies.length * 0.95)
    
    const p50 = sortedLatencies[p50Index] || 0
    const p95 = sortedLatencies[p95Index] || 0

    return NextResponse.json({
      total,
      statusBreakdown: {
        '2xx': status2xx,
        '4xx': status4xx,
        '5xx': status5xx,
      },
      errorRate: parseFloat(errorRate.toFixed(2)),
      latencyPercentiles: {
        p50,
        p95,
      },
    })
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
