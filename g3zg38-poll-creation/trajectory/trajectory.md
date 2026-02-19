# Trajectory

## Analysis

This is a **CREATION** task: building a real-time poll creation and voting web application from scratch. The core challenge involves six interconnected requirements:

1. **Poll Creation Form** - Question input, 2-10 dynamic options, optional expiration, show-results toggle
2. **Shareable URLs** - Short unique IDs via nanoid, dedicated voting page without authentication, copy-to-clipboard
3. **Voting Mechanism** - Single selection, duplicate prevention via localStorage tokens, confirmation feedback
4. **Real-time Results** - Vote counts/percentages, horizontal bar charts, Socket.IO live updates, leading option highlight
5. **Creator Dashboard** - Poll listing from localStorage, detailed results, early close functionality
6. **Results Presentation** - Animated progress bars, total participants, clean summary view

Key constraints identified: no user accounts (localStorage for ownership/dedup), real-time updates mandatory (Socket.IO), specific tech stack (React 18 + TypeScript + Tailwind + Zustand frontend; Node + Express + Socket.IO + MongoDB backend).

## Strategy

**Architecture Choice**: Monorepo with separate server and client directories. Express handles REST API and Socket.IO on the same HTTP server. React SPA with Vite for fast development. This keeps the build simple and avoids Next.js overhead not needed for this scope.

**Duplicate Vote Prevention**: Used localStorage tokens sent with vote requests. Server stores used tokens per poll in `votedTokens[]` array and rejects duplicates with 409. Simpler than browser fingerprinting and meets the spec's "localStorage tokens" option.

**Creator Ownership**: Poll IDs stored in localStorage via Zustand store. No server-side creator identity required. Trade-off accepted: clearing storage loses the dashboard list, but users can still access polls via share links.

**Real-time Updates**: Socket.IO rooms keyed by pollId. When a vote is recorded, server emits `poll-updated` to the room. All clients viewing that poll receive instant updates without polling.

**Testing Strategy**: 
- Backend: supertest for REST endpoints, mongodb-memory-server for isolated tests, Socket.IO client for websocket tests
- Frontend: React Testing Library with mocked API and store
- All tests run via Jest with unified config under `tests/`

## Execution

1. **Project Setup**: Root package.json with dependencies for both server (express, mongoose, socket.io, nanoid) and client (react, zustand, tailwind). Jest config and setup under `tests/` directory.

2. **Backend Implementation**:
   - Mongoose Poll schema with pollId (nanoid), question, options[], totalVotes, showResultsBeforeVote, expiresAt, isClosed, votedTokens[]
   - Routes: POST `/api/polls` (create), GET `/api/polls/:pollId`, POST `/api/polls/:pollId/vote`, PATCH `/api/polls/:pollId/close`
   - Socket.IO: `attachSocket()` wires to HTTP server, handles `join-poll` events, injects `io` into routes for `poll-updated` emissions

3. **Client Implementation**:
   - Zustand store: poll state, createdPollIds (localStorage-backed), vote token management
   - API module: createPoll, getPoll, vote, closePoll wrappers
   - Pages: CreatePoll (form + validation + share link), VotePoll (fetch + socket join + vote/results), Dashboard (list + view/close)
   - Components: CopyLinkButton, ResultsBar (animated width), ResultsSummary (bars + totals + leading highlight)

4. **Test Suite**:
   - `tests/backend/polls.test.ts`: CRUD operations, vote success/duplicate rejection, close poll
   - `tests/backend/polls-socket.test.ts`: Socket.IO join-poll and poll-updated events
   - `tests/ui/*.test.tsx`: CreatePoll form, VotingPage flow, Dashboard actions, ResultsCharts rendering

5. **Evaluation and Docker**:
   - `evaluation/evaluation.ts`: Runs Jest, parses results, generates report.json following standard schema
   - Docker Compose: mongodb service with healthcheck, test-after and evaluation services
   - Both timestamped reports (`evaluation/reports/{date}/{time}/`) and `latest.json`

## Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/) - Real-time bidirectional event-based communication
- [Mongoose ODM](https://mongoosejs.com/docs/) - MongoDB object modeling for Node.js
- [nanoid](https://github.com/ai/nanoid) - Secure, URL-friendly unique ID generator
- [Zustand](https://github.com/pmndrs/zustand) - Lightweight state management for React
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) - Testing React components
- [supertest](https://github.com/ladjs/supertest) - HTTP assertions for testing Express apps
