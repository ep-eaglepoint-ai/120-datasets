# Trajectory: API Usage Monitor

## 1. Audit the Requirements

Analyzed 16 requirements for building an API Usage Monitor as a standalone Next.js application:

- **Backend Complexity**: Need API routes for ingestion, metrics, and events with proper validation
- **Database Design**: Multi-tenant PostgreSQL schema with proper isolation and indexing
- **Authentication**: Dual authentication system (API keys for ingestion, NextAuth for UI)
- **Authorization**: Role-based access control (Admin vs Viewer) with tenant restrictions
- **Data Aggregation**: Calculate metrics (totals, error rates, percentiles) efficiently
- **UI Requirements**: Dashboard with time ranges, paginated events table, filtering
- **Performance**: Rate limiting, input validation, indexed queries
- **Scope Control**: Keep intentionally simple without alerting or advanced analytics

## 2. Define the Architecture Contract

**Data Layer**:
- PostgreSQL with Prisma ORM
- Tables: Tenant, ApiKey, ApiEvent, User
- Indexes on (tenantId, timestamp) and (tenantId, endpoint, timestamp)
- Multi-tenant isolation enforced at query level

**Authentication Layer**:
- API key authentication for /api/ingest (SHA-256 hashed keys)
- NextAuth with credentials provider for UI access
- Role-based access: Admin (all tenants), Viewer (own tenant only)

**API Routes**:
- POST /api/ingest - Validate and store API events
- GET /api/metrics - Aggregate statistics with percentile calculations
- GET /api/events - Paginated event listing with filters
- POST /api/auth - NextAuth authentication endpoint

**Frontend**:
- Next.js 14 App Router with TypeScript
- TailwindCSS for styling
- Pages: Dashboard (metrics), Events (table), Sign In
- Time range selection: 1h, 24h, 7d
- Client-side data fetching with React hooks

## 3. Design the Data Model

**Prisma Schema**:
```prisma
Tenant { id, name, createdAt, updatedAt }
ApiKey { id, tenantId, keyHash, createdAt, revokedAt }
ApiEvent { id, tenantId, timestamp, endpoint, method, statusCode, latencyMs, requestId }
User { id, email, password, role, tenantId, createdAt, updatedAt }
```

**Key Design Decisions**:
- SHA-256 hashing for API keys (security)
- Composite indexes for query performance
- Cascade deletes for data consistency
- Timestamp-based queries for time range filtering

## 4. Implement Backend API Routes

**Ingestion Pipeline** (/api/ingest):
1. Validate API key header
2. Check rate limits (100 req/min per tenant)
3. Validate request body with Zod
4. Enforce tenant ID matching
5. Store event in database

**Metrics Calculation** (/api/metrics):
1. Authenticate user session
2. Enforce role-based access
3. Query events within time range
4. Calculate: total, 2xx/4xx/5xx counts, error rate, p50/p95 latency
5. Return aggregated metrics

**Events Listing** (/api/events):
1. Authenticate user session
2. Apply filters (time, endpoint, status group, search)
3. Paginate results (default 20 per page)
4. Return events with pagination metadata

## 5. Implement Authentication and Authorization

**NextAuth Configuration**:
- Credentials provider with bcrypt password hashing
- JWT session strategy
- Custom callbacks to include role and tenantId in session
- Sign-in page with email/password form

**Authorization Enforcement**:
- Admin role: Can query any tenantId
- Viewer role: Restricted to own tenantId
- 403 Forbidden for unauthorized access attempts

## 6. Build the Frontend UI

**Dashboard Page**:
- Time range selector (1h/24h/7d buttons)
- Metric cards: Total Requests, Error Rate, p95 Latency
- Status breakdown table (2xx/4xx/5xx)
- Link to Events page

**Events Page**:
- Filter controls (endpoint, status group)
- Paginated table with columns: Timestamp, Endpoint, Method, Status, Latency
- Color-coded status badges (green/yellow/red)
- Previous/Next pagination controls

**Authentication Flow**:
- Redirect unauthenticated users to /auth/signin
- Sign-in form with email/password
- Redirect to /dashboard on success

## 7. Implement Validation and Rate Limiting

**Input Validation** (Zod schemas):
- IngestEventSchema: Validates all required fields, types, and ranges
- MetricsQuerySchema: Validates tenantId and optional time range
- EventsQuerySchema: Validates filters and pagination parameters

**Rate Limiting**:
- In-memory Map tracking request counts per tenant
- 100 requests per 60-second window
- Returns 429 Too Many Requests when exceeded

## 8. Testing Strategy

**Test Coverage** (16 requirements):
- Requirement validation tests for each specification
- API endpoint behavior tests
- Metrics calculation tests (totals, error rates, percentiles)
- Authentication and authorization tests
- Filtering and pagination tests
- Rate limiting tests
- Multi-tenant isolation tests

**Test Framework**:
- Jest with TypeScript support
- Mock-based testing for isolated unit tests
- Validation of all 16 requirements

## 9. Evaluation System

**Evaluation Runner** (evaluation.ts):
- Executes Jest test suite
- Parses JSON output for test results
- Generates UUID run ID
- Measures execution time
- Produces formatted console output matching specification
- Saves JSON report to `evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json`
- Exits with code 0

**Report Structure**:
- run_id, task_title, timestamps, duration
- test_results with individual test details and IDs
- overall_status (PASSED/FAILED)

## 10. Docker Configuration

**Dockerfile**:
- Node.js 20 Alpine base image
- Install dependencies and generate Prisma client
- Copy application code and evaluation script
- Default command runs evaluation

**docker-compose.yml**:
- App service with environment variables
- PostgreSQL 15 service for database
- Volume mounts for code and node_modules
- Two commands: test and evaluation

## 11. Result: Complete API Usage Monitor

**Functional Completeness**:
- ✅ Standalone Next.js with TypeScript
- ✅ Backend API routes for ingestion, metrics, events
- ✅ PostgreSQL with Prisma ORM
- ✅ Multi-tenant data isolation
- ✅ API key authentication for ingestion
- ✅ Admin and Viewer roles
- ✅ Admin views all tenants, Viewer restricted to own
- ✅ Display total requests, error rate, latency percentiles
- ✅ Time range selection (1h, 24h, 7d)
- ✅ Paginated events table
- ✅ Filtering by time, endpoint, status group
- ✅ Request detail view in table
- ✅ Input validation and rate limiting
- ✅ Clean UI with Tailwind CSS
- ✅ Simple scope without advanced features

**Architecture Quality**:
- Type-safe with TypeScript and Zod validation
- Secure authentication with hashed passwords and API keys
- Efficient database queries with proper indexing
- Clean separation of concerns (API, UI, data)
- Minimal and maintainable codebase

**Testing & Verification**:
- 16 requirement validation tests
- Comprehensive test coverage
- Evaluation system with structured reporting
- Docker integration for reproducible builds

## Trajectory Transferability

This trajectory demonstrates **Requirements Analysis → Architecture Design → Incremental Implementation → Testing → Deployment** pattern:

- **Audit** identified 16 distinct requirements and technical constraints
- **Design** created clear data models, API contracts, and UI specifications
- **Implement** built each component systematically (backend → auth → frontend)
- **Test** validated all requirements with comprehensive test suite
- **Deploy** containerized with Docker for reproducible execution

The same pattern transfers to:
- **API Development**: Audit endpoints → Design schemas → Implement routes → Test contracts → Deploy
- **Full-Stack Apps**: Audit features → Design architecture → Build incrementally → Test integration → Ship
- **Database Systems**: Audit requirements → Design schema → Implement queries → Test performance → Deploy

The core principle: **systematic analysis, clear contracts, incremental execution, rigorous verification**.
