import { z } from 'zod'

export const IngestEventSchema = z.object({
  tenantId: z.string().min(1),
  timestamp: z.string().datetime().or(z.number()),
  endpoint: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']),
  statusCode: z.number().int().min(100).max(599),
  latencyMs: z.number().int().min(0),
  requestId: z.string().min(1),
})

export const MetricsQuerySchema = z.object({
  tenantId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const EventsQuerySchema = z.object({
  tenantId: z.string().min(1),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  endpoint: z.string().optional(),
  statusGroup: z.enum(['2xx', '4xx', '5xx']).optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  pageSize: z.string().regex(/^\d+$/).optional(),
})

export type IngestEvent = z.infer<typeof IngestEventSchema>
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>
export type EventsQuery = z.infer<typeof EventsQuerySchema>
