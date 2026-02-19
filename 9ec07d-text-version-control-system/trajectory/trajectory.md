# Trajectory (Thinking Process for Full-Stack Development)

## 1. Audit Requirements & Identify Core Challenges

I audited the requirements for building a text version control system. The system must treat wiki pages as immutable, version-controlled repositories where each edit creates a new permanent node that can branch from any prior state, forming a directed acyclic graph (DAG) instead of linear history.

**Key Challenges Identified:**
- **Immutability**: No version can ever be overwritten or deleted
- **DAG Structure**: Must prevent circular references while allowing branching
- **Conflict Resolution**: Need automatic merging with manual conflict resolution fallback
- **Graph Visualization**: Users must navigate and compare non-linear version history
- **Data Integrity**: Parent relationships must be validated to maintain DAG properties

**Resources:**
- Understanding DAG structures: [Directed Acyclic Graphs Explained](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
- Version control fundamentals: [Git Internals - Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)

## 2. Define System Contracts & Architecture

I defined the core contracts that the system must enforce:

**Data Contracts:**
- Each `Page` is a container with an ID and title
- Each `VersionNode` is immutable with content, author, timestamp, message, and `parentIds[]`
- `parentIds` array enables branching (empty for root, one parent for linear edits, multiple for merges)
- DAG integrity: parent versions must exist before children can reference them

**API Contracts:**
- `POST /api/pages`: Create new wiki page
- `POST /api/versions`: Create new immutable version (validates parent existence)
- `GET /api/pages/[id]`: Retrieve complete version graph for a page
- `POST /api/merge`: Attempt automatic merge or flag conflicts

**UX Contracts:**
- Graph visualization must show all versions and their relationships
- Users can fork from any version, not just the latest
- Merge interface allows selecting two versions to combine
- Conflict resolution provides manual editing when auto-merge fails

**Resources:**
- API design patterns: [REST API Best Practices](https://stackoverflow.blog/2020/03/02/best-practices-for-rest-api-design/)
- [YouTube: System Design Fundamentals](https://www.youtube.com/watch?v=FSR1s2b-l_I)

## 3. Design the Data Model for Immutability & DAG Integrity

I designed a data model that enforces immutability and DAG structure:

**Core Types (`lib/types.ts`):**
```typescript
interface Page {
  id: string;
  title: string;
  createdAt: number;
}

interface VersionNode {
  id: string;           // Unique UUID
  pageId: string;       // Parent page reference
  content: string;      // Immutable content snapshot
  parentIds: string[];  // DAG edges (empty = root, 1 = linear, 2+ = merge)
  author: string;
  timestamp: number;
  message: string;      // Commit-like message
}
```

**Storage Layer (`lib/store.ts`):**
- File-based JSON storage for prototype (would be database in production)
- Integrity validation: `addVersion()` checks that all `parentIds` exist before insertion
- This prevents dangling references and maintains DAG structure

**Resources:**
- Immutable data structures: [Immutability in JavaScript](https://www.sitepoint.com/immutability-javascript/)
- Graph data modeling: [Graph Database Concepts](https://neo4j.com/developer/graph-database/)

## 4. Implement API Routes with Validation

I built Next.js API routes that enforce the contracts:

**Version Creation (`/api/versions/route.ts`):**
- Validates parent versions exist before creating new nodes
- Generates unique IDs using UUID
- Persists immutable version to storage
- Returns error if parent validation fails (prevents DAG corruption)

**Page Retrieval (`/api/pages/[id]/route.ts`):**
- Fetches all versions for a page
- Constructs edge list from parent relationships
- Returns complete DAG graph structure for frontend visualization

**Merge Endpoint (`/api/merge/route.ts`):**
- Accepts two version IDs to merge
- Attempts automatic 3-way merge using common ancestor
- Flags conflicts when edits overlap
- Returns merged content or conflict indicator

**Resources:**
- Next.js API routes: [Route Handlers Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [YouTube: Next.js API Routes Tutorial](https://www.youtube.com/watch?v=vrR5ZLWJq2Y)

## 5. Build Graph Visualization with React Flow

I integrated React Flow to visualize the DAG structure:

**Implementation (`components/DagGraph.tsx`):**
- Maps `VersionNode[]` to React Flow's node format
- Constructs edges from `parentIds` relationships
- Configures hierarchical layout (top-to-bottom or left-to-right)
- Enables node selection for forking and merging operations
- Displays version metadata (author, timestamp, message) on nodes

**Layout Strategy:**
- Used automatic layout algorithms (dagre) to position nodes
- Time flows downward/rightward to show version progression
- Branches visually diverge, merges converge

**Resources:**
- [React Flow Documentation](https://reactflow.dev/)
- [YouTube: React Flow Crash Course](https://www.youtube.com/watch?v=Fjrx1Xh-uSQ)
- Graph layout algorithms: [Dagre Layout](https://github.com/dagrejs/dagre)

## 6. Implement Three-Way Merge & Conflict Detection

I built merge logic using the `diff` library:

**Merge Strategy (`lib/merge.ts`):**
- **Three-way merge**: Compare both versions against common ancestor
- **Auto-merge success**: When changes are on different lines/chunks
- **Conflict detection**: When both versions modify the same region
- **Conservative approach**: Flag conflicts rather than risk data loss

**Algorithm:**
1. Find common ancestor (lowest common ancestor in DAG)
2. Diff ancestor → version A
3. Diff ancestor → version B
4. If changes are disjoint, combine them
5. If changes overlap, return conflict flag

**Resources:**
- [NPM: diff package](https://www.npmjs.com/package/diff)
- [Myers Diff Algorithm Explained](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/)
- [YouTube: How Git Merging Works](https://www.youtube.com/watch?v=0iuqXh0oojo)

## 7. Build Frontend for Editing, Forking & Conflict Resolution

I created the user interface for version control operations:

**Version Editor:**
- Text area for editing content
- "Save as New Version" creates immutable snapshot
- Can fork from any selected version in the graph

**Merge Interface:**
- Select two versions from graph visualization
- Click "Merge" to attempt automatic merge
- Shows success message with merged content or conflict indicator

**Conflict Resolver:**
- Three-pane view: Version A | Common Ancestor | Version B
- Manual editing area for resolved content
- "Save Resolved Version" creates merge commit with both parents

**Page Navigation (`app/pages/[id]/page.tsx`):**
- Displays current page with graph visualization
- Lists all versions with metadata
- Provides controls for all version control operations

**Resources:**
- React state management: [useState and useEffect](https://react.dev/learn/state-a-components-memory)
- Form handling: [React Forms Best Practices](https://react.dev/learn/sharing-state-between-components)

## 8. Containerization & Testing Infrastructure

I created Docker configuration for reproducible testing:

**Docker Setup:**
- `Dockerfile`: Node.js 18 Alpine base image
- Multi-stage build for Next.js application
- `docker-compose.yml`: Services for `test-before`, `test-after`, and `evaluation`

**Testing Strategy:**
- `test-before`: Run tests on empty repository_before
- `test-after`: Run tests on complete repository_after implementation
- `evaluation`: Compare results and generate reports

**Resources:**
- [Docker for Node.js](https://nodejs.org/en/docs/guides/nodejs-docker-webapp)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)

## 9. Verification & Requirements Validation

I validated that all 8 requirements are met:

✅ **Requirement 1**: Each wiki page stores multiple immutable versions (enforced by `VersionNode[]` storage)  
✅ **Requirement 2**: Every edit creates new version, can branch from any previous version (via `parentIds[]`)  
✅ **Requirement 3**: Version history represented as DAG (explicit graph structure with nodes and edges)  
✅ **Requirement 4**: Versions reference parent versions (validated in `store.addVersion()`)  
✅ **Requirement 5**: Two versions can be merged into new version (merge API creates version with 2 parents)  
✅ **Requirement 6**: Automatic merging attempted, conflicts detected (three-way merge in `lib/merge.ts`)  
✅ **Requirement 7**: Conflicts manually resolved (conflict resolver UI component)  
✅ **Requirement 8**: Users view version history including branches/merges (React Flow visualization)

**Result: Complete Implementation**
- All version control operations functional
- DAG integrity maintained through validation
- Immutability enforced at storage layer
- Graph visualization enables navigation
- Merge and conflict resolution working

---

## Trajectory Transferability Notes

This trajectory follows the **Audit → Contract → Design → Execute → Verify** pattern adapted for **Full-Stack Development**.

**Core Pattern Applied:**
1. **Audit**: Requirements analysis → identified DAG challenges
2. **Contract**: Defined data, API, and UX contracts
3. **Design**: Created immutable data model with integrity validation
4. **Execute**: Built API routes, graph visualization, merge logic, and UI
5. **Verify**: Validated all 8 requirements met

**Transferable to Other Categories:**

**Full-Stack → Refactoring:**
- Replace requirements audit with code audit
- Contracts become performance contracts
- Design focuses on optimization patterns
- Verification uses benchmarks instead of requirement checklist

**Full-Stack → Performance Optimization:**
- Audit becomes profiling and bottleneck detection
- Contracts expand to SLOs and latency budgets
- Design includes caching, indexing, async patterns
- Verification uses load tests and metrics

**Full-Stack → Testing:**
- Audit becomes test coverage analysis
- Contracts become test strategy and guarantees
- Design maps to test fixtures and factories
- Verification ensures assertions and invariants

**Core Principle (Applies to All):**
- The trajectory structure stays the same
- Only the focus and artifacts change
- **Audit → Contract → Design → Execute → Verify** remains constant
