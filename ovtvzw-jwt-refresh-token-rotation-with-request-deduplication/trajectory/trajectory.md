# Trajectory - JWT Refresh Token Rotation with Request Deduplication

## 1. Audit the Requirements (Identify Engineering Challenge)

I audited the task requirements. The core engineering challenge is the "Thundering Herd" problem: when multiple simultaneous requests receive 401 errors, a naive implementation would trigger multiple refresh token calls, causing race conditions and token invalidation issues.

Key requirements identified:
- Must use native fetch (no Axios)
- Server must simulate 3-second token expiration
- Client must detect 401 responses
- Must implement singleton promise pattern to prevent multiple refresh calls
- Failed requests must queue during refresh
- All queued requests must retry after successful refresh
- All queued requests must reject gracefully if refresh fails
- Consuming components must not know refresh occurred

## 2. Define a Technical Contract

I defined the technical contract:
- **Backend**: Express server with `/api/data` (protected) and `/api/refresh` endpoints
- **Frontend**: Vue 3 composable `useAuthFetch.ts` wrapping native fetch
- **Concurrency**: Singleton promise pattern with request queue
- **Token Lifecycle**: 3-second expiry, 100-300ms artificial refresh delay
- **Error Handling**: Graceful rejection propagation to all queued requests

## 3. Design the Architecture

### Backend (`repository_after/backend/src/server.js`)
- Raw Express server (no external middleware)
- JWT-based authentication with configurable expiry
- `/api/login` - Issue access and refresh tokens
- `/api/refresh` - Token rotation with artificial latency (100-300ms)
- `/api/data` - Protected endpoint enforcing token validity

### Frontend (`repository_after/frontend/src/composables/useAuthFetch.ts`)
- Singleton token store using Vue 3 reactivity
- `isRefreshing` flag to prevent concurrent refresh calls
- `refreshPromise` singleton to share result with queued requests
- `failedRequestsQueue` array to hold pending requests
- Transparent retry mechanism invisible to consumers

## 4. Implement the Solution

### Step 1: Backend Implementation
Created `backend/src/server.js` with:
- JWT token generation with 3-second expiry
- Token verification middleware
- Random 100-300ms delay on refresh endpoint
- Protected data endpoints

### Step 2: Frontend Composable
Created `frontend/src/composables/useAuthFetch.ts` with:
- Singleton promise pattern for refresh deduplication
- Request queue for failed requests during refresh
- Automatic retry with new token after successful refresh
- Graceful rejection propagation on refresh failure
- Transparent operation (consumers unaware of refresh)

### Step 3: Test Suite
Created comprehensive tests in `tests/auth.test.ts` covering all 8 requirements:
- Native fetch usage verification
- Token expiration simulation
- 401 detection and handling
- Singleton promise/logic lock verification
- Request queue functionality
- Retry after successful refresh
- Graceful rejection on refresh failure
- Transparent operation verification
- Thundering herd prevention with 10 simultaneous requests

## 5. Verification

### Test Coverage
- 22 test cases covering all requirements
- Edge cases: no token, server unavailable, multiple refresh cycles
- Thundering herd simulation with 10 concurrent requests

### Docker Configuration
- Node.js 20 base image with Python 3 for evaluation
- Single service supporting two commands:
  - `npm test --prefix /app/tests` - Run tests
  - `python3 evaluation/evaluation.py` - Run evaluation

### Test Results
```
Test Files  1 passed (1)
Tests  22 passed (22)
Duration  4.63s
```

## 6. Result: Deterministic Behavior

The solution ensures:
- Only ONE refresh request regardless of concurrent 401 failures
- All pending requests resolved with same refresh result
- Graceful failure propagation on refresh error
- Transparent operation for consuming components
- Predictable, race-condition-free token rotation

## Project Structure

```
repository_after/
├── backend/
│   ├── package.json
│   └── src/
│       └── server.js
└── frontend/
    ├── package.json
    └── src/
        └── composables/
            └── useAuthFetch.ts

tests/
├── auth.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts

evaluation/
└── evaluation.py
```

## Files Created

| File | Purpose |
|------|---------|
| `repository_after/backend/src/server.js` | Express backend with auth endpoints |
| `repository_after/backend/package.json` | Backend dependencies |
| `repository_after/frontend/src/composables/useAuthFetch.ts` | Vue 3 composable with singleton pattern |
| `repository_after/frontend/package.json` | Frontend dependencies |
| `tests/auth.test.ts` | Comprehensive test suite (22 tests) |
| `tests/package.json` | Test dependencies |
| `tests/vitest.config.ts` | Test configuration |
| `tests/tsconfig.json` | TypeScript configuration |
| `evaluation/evaluation.py` | Test runner and report generator |
| `Dockerfile` | Container build configuration |
| `docker-compose.yml` | Service orchestration |

## Trajectory Nodes Applied

1. **Audit** → Identified Thundering Herd as core challenge
2. **Contract** → Defined singleton promise and queue patterns
3. **Design** → Separated backend/frontend with professional folder structure
4. **Execute** → Implemented with Vue 3 reactivity and Express
5. **Verify** → 22/22 tests passed + Docker validation
