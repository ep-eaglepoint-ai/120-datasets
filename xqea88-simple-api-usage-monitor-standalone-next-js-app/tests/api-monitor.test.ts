import { describe, it, expect, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Import actual implementation modules for real testing
import { IngestEventSchema, MetricsQuerySchema, EventsQuerySchema } from '../repository_after/src/lib/validation';
import { rateLimit } from '../repository_after/src/lib/rate-limit';

const REPO_PATH = path.join(__dirname, '..', 'repository_after');


describe('Standalone Next.js with TypeScript', () => {
  it('should have package.json with Next.js dependency', () => {
    const pkgPath = path.join(REPO_PATH, 'package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('next');
    expect(pkg.dependencies.next).toMatch(/^\^?14/);
  });

  it('should have tsconfig.json for TypeScript', () => {
    const tsconfigPath = path.join(REPO_PATH, 'tsconfig.json');
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });

  it('should have Next.js App Router structure', () => {
    expect(fs.existsSync(path.join(REPO_PATH, 'src', 'app'))).toBe(true);
    expect(fs.existsSync(path.join(REPO_PATH, 'src', 'app', 'page.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(REPO_PATH, 'src', 'app', 'layout.tsx'))).toBe(true);
  });
});


describe('Backend API routes for ingesting events', () => {
  it('should have /api/ingest route file', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'ingest', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should validate ingest event with all required fields', () => {
    const validEvent = {
      tenantId: 'tenant-123',
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/api/users',
      method: 'GET',
      statusCode: 200,
      latencyMs: 150,
      requestId: 'req-abc-123'
    };
    const result = IngestEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it('should reject ingest event with missing tenantId', () => {
    const invalidEvent = {
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/api/users',
      method: 'GET',
      statusCode: 200,
      latencyMs: 150,
      requestId: 'req-abc-123'
    };
    const result = IngestEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('should reject ingest event with invalid HTTP method', () => {
    const invalidEvent = {
      tenantId: 'tenant-123',
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/api/users',
      method: 'INVALID',
      statusCode: 200,
      latencyMs: 150,
      requestId: 'req-abc-123'
    };
    const result = IngestEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('should reject ingest event with invalid status code', () => {
    const invalidEvent = {
      tenantId: 'tenant-123',
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/api/users',
      method: 'GET',
      statusCode: 999,
      latencyMs: 150,
      requestId: 'req-abc-123'
    };
    const result = IngestEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });

  it('should reject ingest event with negative latency', () => {
    const invalidEvent = {
      tenantId: 'tenant-123',
      timestamp: '2024-01-15T10:30:00Z',
      endpoint: '/api/users',
      method: 'GET',
      statusCode: 200,
      latencyMs: -10,
      requestId: 'req-abc-123'
    };
    const result = IngestEventSchema.safeParse(invalidEvent);
    expect(result.success).toBe(false);
  });
});


describe('PostgreSQL with Prisma ORM', () => {
  it('should have Prisma schema file', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('should have Prisma schema with PostgreSQL provider', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('provider = "postgresql"');
  });

  it('should have ApiEvent model in schema', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('model ApiEvent');
    expect(schema).toContain('tenantId');
    expect(schema).toContain('timestamp');
    expect(schema).toContain('endpoint');
    expect(schema).toContain('statusCode');
    expect(schema).toContain('latencyMs');
  });

  it('should have indexes on (tenantId, timestamp)', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('@@index([tenantId, timestamp])');
  });
});


describe('Multi-tenant data isolation', () => {
  it('should have Tenant model in Prisma schema', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('model Tenant');
  });

  it('should require tenantId in metrics query', () => {
    const validQuery = { tenantId: 'tenant-123' };
    const result = MetricsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it('should reject metrics query without tenantId', () => {
    const invalidQuery = { from: '2024-01-01T00:00:00Z' };
    const result = MetricsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
  });

  it('should require tenantId in events query', () => {
    const validQuery = { tenantId: 'tenant-123' };
    const result = EventsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });
});


describe('API key authentication', () => {
  it('should have ApiKey model in Prisma schema', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('model ApiKey');
    expect(schema).toContain('keyHash');
    expect(schema).toContain('tenantId');
  });

  it('should have ingest route that checks x-api-key header', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'ingest', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('x-api-key');
  });

  it('should hash API keys with SHA-256', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'ingest', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('sha256');
  });
});


describe('Admin and Viewer roles', () => {
  it('should have User model with role field in Prisma schema', () => {
    const schemaPath = path.join(REPO_PATH, 'prisma', 'schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('model User');
    expect(schema).toContain('role');
  });

  it('should have NextAuth configuration', () => {
    const authPath = path.join(REPO_PATH, 'src', 'lib', 'auth.ts');
    expect(fs.existsSync(authPath)).toBe(true);
    const authCode = fs.readFileSync(authPath, 'utf-8');
    expect(authCode).toContain('NextAuthOptions');
    expect(authCode).toContain('CredentialsProvider');
  });

  it('should include role in session', () => {
    const authPath = path.join(REPO_PATH, 'src', 'lib', 'auth.ts');
    const authCode = fs.readFileSync(authPath, 'utf-8');
    expect(authCode).toContain('token.role');
    expect(authCode).toContain('session.user.role');
  });
});


describe('Admin views all tenants', () => {
  it('should check for ADMIN role in metrics route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain("role !== 'ADMIN'");
  });

  it('should check for ADMIN role in events route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'events', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain("role !== 'ADMIN'");
  });
});


describe('Viewer restricted to own tenant', () => {
  it('should enforce tenant restriction in metrics route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('session.user.tenantId');
    expect(routeCode).toContain('Forbidden');
  });

  it('should enforce tenant restriction in events route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'events', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('session.user.tenantId');
    expect(routeCode).toContain('Forbidden');
  });
});


describe('Display metrics', () => {
  it('should have metrics API route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should calculate total requests in metrics', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('total');
  });

  it('should calculate error rate in metrics', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('errorRate');
  });

  it('should calculate p50 and p95 latency percentiles', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'metrics', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('p50');
    expect(routeCode).toContain('p95');
  });

  it('should have dashboard page displaying metrics', () => {
    const dashboardPath = path.join(REPO_PATH, 'src', 'app', 'dashboard', 'page.tsx');
    expect(fs.existsSync(dashboardPath)).toBe(true);
    const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
    expect(dashboardCode).toContain('Total Requests');
    expect(dashboardCode).toContain('Error Rate');
    expect(dashboardCode).toContain('Latency');
  });
});


describe('Time range selection', () => {
  it('should have time range buttons in dashboard', () => {
    const dashboardPath = path.join(REPO_PATH, 'src', 'app', 'dashboard', 'page.tsx');
    const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
    expect(dashboardCode).toContain("'1h'");
    expect(dashboardCode).toContain("'24h'");
    expect(dashboardCode).toContain("'7d'");
  });

  it('should support from/to parameters in metrics query', () => {
    const validQuery = {
      tenantId: 'tenant-123',
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-02T00:00:00Z'
    };
    const result = MetricsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });
});

describe('Paginated events table', () => {
  it('should have events API route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'events', 'route.ts');
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it('should support page and pageSize parameters', () => {
    const validQuery = {
      tenantId: 'tenant-123',
      page: '2',
      pageSize: '20'
    };
    const result = EventsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it('should have pagination logic in events route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'events', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('skip');
    expect(routeCode).toContain('take');
    expect(routeCode).toContain('totalPages');
  });

  it('should have events page with table', () => {
    const eventsPath = path.join(REPO_PATH, 'src', 'app', 'events', 'page.tsx');
    expect(fs.existsSync(eventsPath)).toBe(true);
  });
});


describe('Filtering capabilities', () => {
  it('should support endpoint filter in events query', () => {
    const validQuery = {
      tenantId: 'tenant-123',
      endpoint: '/api/users'
    };
    const result = EventsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
  });

  it('should support statusGroup filter (2xx, 4xx, 5xx)', () => {
    const query2xx = { tenantId: 'tenant-123', statusGroup: '2xx' };
    const query4xx = { tenantId: 'tenant-123', statusGroup: '4xx' };
    const query5xx = { tenantId: 'tenant-123', statusGroup: '5xx' };
    
    expect(EventsQuerySchema.safeParse(query2xx).success).toBe(true);
    expect(EventsQuerySchema.safeParse(query4xx).success).toBe(true);
    expect(EventsQuerySchema.safeParse(query5xx).success).toBe(true);
  });

  it('should reject invalid statusGroup', () => {
    const invalidQuery = { tenantId: 'tenant-123', statusGroup: '3xx' };
    const result = EventsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
  });

  it('should have filter implementation in events route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'events', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('statusGroup');
    expect(routeCode).toContain('endpoint');
  });
});


describe('Request detail view', () => {
  it('should have events page with event details display', () => {
    const eventsPath = path.join(REPO_PATH, 'src', 'app', 'events', 'page.tsx');
    const eventsCode = fs.readFileSync(eventsPath, 'utf-8');
    expect(eventsCode).toContain('Timestamp');
    expect(eventsCode).toContain('Endpoint');
    expect(eventsCode).toContain('Method');
    expect(eventsCode).toContain('Status');
  });
});

describe('Input validation and rate limiting', () => {
  it('should have rate limiting function', () => {
    expect(typeof rateLimit).toBe('function');
  });

  it('should allow requests under rate limit', () => {
    const result = rateLimit('test-tenant-new', 100, 60000);
    expect(result).toBe(true);
  });

  it('should block requests exceeding rate limit', () => {
    const testId = 'test-tenant-limit-' + Date.now();
    // Make 100 requests (the limit)
    for (let i = 0; i < 100; i++) {
      rateLimit(testId, 100, 60000);
    }
    // 101st request should be blocked
    const result = rateLimit(testId, 100, 60000);
    expect(result).toBe(false);
  });

  it('should use Zod for validation in ingest route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'ingest', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('IngestEventSchema');
    expect(routeCode).toContain('.parse');
  });

  it('should call rateLimit in ingest route', () => {
    const routePath = path.join(REPO_PATH, 'src', 'app', 'api', 'ingest', 'route.ts');
    const routeCode = fs.readFileSync(routePath, 'utf-8');
    expect(routeCode).toContain('rateLimit');
    expect(routeCode).toContain('429');
  });
});

describe('Clean UI with Tailwind CSS', () => {
  it('should have Tailwind CSS configured', () => {
    const tailwindPath = path.join(REPO_PATH, 'tailwind.config.js');
    expect(fs.existsSync(tailwindPath)).toBe(true);
  });

  it('should have Tailwind directives in global CSS', () => {
    const cssPath = path.join(REPO_PATH, 'src', 'app', 'globals.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@tailwind base');
    expect(css).toContain('@tailwind components');
    expect(css).toContain('@tailwind utilities');
  });

  it('should use Tailwind classes in dashboard', () => {
    const dashboardPath = path.join(REPO_PATH, 'src', 'app', 'dashboard', 'page.tsx');
    const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');
    expect(dashboardCode).toContain('className=');
    expect(dashboardCode).toMatch(/bg-|text-|p-|m-|flex|grid/);
  });
});


describe('Simple scope without advanced features', () => {
  it('should NOT have alerting system', () => {
    const srcPath = path.join(REPO_PATH, 'src');
    const allFiles = getAllFiles(srcPath);
    const hasAlerting = allFiles.some(file => {
      const content = fs.readFileSync(file, 'utf-8').toLowerCase();
      return content.includes('alert') && content.includes('threshold');
    });
    expect(hasAlerting).toBe(false);
  });

  it('should NOT have anomaly detection', () => {
    const srcPath = path.join(REPO_PATH, 'src');
    const allFiles = getAllFiles(srcPath);
    const hasAnomalyDetection = allFiles.some(file => {
      const content = fs.readFileSync(file, 'utf-8').toLowerCase();
      return content.includes('anomaly') || content.includes('machine learning') || content.includes('tensorflow');
    });
    expect(hasAnomalyDetection).toBe(false);
  });
});

// Helper function to get all files recursively
function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}
