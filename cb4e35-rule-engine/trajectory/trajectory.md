# AI Development Trajectory: Rule Engine - Personal Laws System

## Overview
This document outlines the development process for creating a full-stack Next.js application that allows users to define their own laws as IF-THEN rules with conflict resolution and explainable reasoning.

---

## Phase 1: Requirements Analysis

**Goal**: Build a rule engine where users can define personal laws, evaluate scenarios, and receive transparent explanations of how conflicts are resolved.

**Key Requirements**:
1. Users can create laws as IF-THEN rules with conditions and consequences
2. Rules can override or conflict with other rules
3. The system evaluates a scenario by applying all relevant rules
4. Conflicts between rules must be detected and resolved deterministically
5. The system produces a reasoning path showing which rules were applied or overridden
6. Users can view the final outcome and explanation
7. No auth required
8. Minimal User Interface

**Example Use Case**:
- **Law A**: IF it's raining, THEN carry an umbrella
- **Law B**: IF it's raining AND it's windy, THEN do not carry an umbrella
- **Law C**: IF it's a weekend, THEN relax

**Scenario**: Today is raining, windy, and a weekend.
**Expected Result**: Law B overrides Law A → do not carry an umbrella. Law C → relax.

---

## Phase 2: Technical Architecture

### Technology Stack Selection
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB
- **Testing**: Jest + React Testing Library
- **Styling**: Tailwind CSS (minimal UI)

### Core Components
1. **Rule Engine Logic** (`lib/ruleEngine.ts`)
   - Rule matching
   - Conflict detection
   - Specificity-based resolution
   - Reasoning path generation

2. **API Routes**
   - `/api/rules` - CRUD operations for rules
   - `/api/evaluate` - Evaluate scenarios

3. **Frontend** (`app/page.tsx`)
   - Rule creation form
   - Scenario evaluation form
   - Results display with reasoning

4. **Database Layer** (`lib/mongodb.ts`)
   - MongoDB connection management
   - No auth required

---

## Phase 3: Implementation

### Step 3.1: Rule Engine Core Logic

**Conflict Resolution Strategy**:
- More specific rules (more conditions) override less specific ones
- Deterministic evaluation (same scenario always produces same result)
- Track overridden rules for transparency

**Key Functions**:
```typescript
matchesCondition(): Check if rule applies to scenario
isMoreSpecific(): Compare rule specificity
detectConflict(): Identify conflicting rules
resolveConflicts(): Apply specificity-based resolution
evaluateScenario(): Main evaluation function
generateReasoningPath(): Create explanation
```

**Algorithm**:
1. Find all rules matching the scenario
2. Group by consequence to detect conflicts
3. Sort by specificity (number of conditions)
4. Apply most specific rule from each group
5. Track overrides and generate reasoning

### Step 3.2: Database Schema

**Rule Document**:
```typescript
{
  id: string (unique identifier)
  name: string (Law A, Law B, etc.)
  condition: { key: value } (flexible object)
  consequence: string (action to take)
  createdAt: Date
}
```

**No User Model**: No authentication required

### Step 3.3: API Implementation

**POST /api/rules**: Create new rule
- Validate condition and consequence
- Generate unique ID
- Store in MongoDB

**GET /api/rules**: Fetch all rules
- Return all rules for display

**DELETE /api/rules**: Delete rule by ID
- Remove from database

**POST /api/evaluate**: Evaluate scenario
- Fetch all rules
- Run rule engine evaluation
- Return results with reasoning

### Step 3.4: Frontend Implementation

**Minimal UI Design**:
- Single page application
- Two main sections: Create Rule, Evaluate Scenario
- Simple form inputs
- Clear result display with reasoning path
- No authentication flows
- Clean, functional design with Tailwind CSS

**User Flow**:
1. Create rules with conditions and consequences
2. Input scenario to evaluate
3. View results, conflicts, and reasoning
4. See which rules were applied/overridden

### Step 3.5: Conflict Resolution Logic

**Specificity Rule**:
- Rule with more conditions is more specific
- More specific rules override less specific ones
- Example: "raining AND windy" overrides "raining"

**Determinism**:
- Same rules + same scenario = same result
- No randomness in resolution
- Consistent ordering

---

## Phase 4: Testing Strategy

### Test Suite Design
Created comprehensive tests mapping to each requirement:

1. **Requirement 1 - Rule Creation**: Test rule structure and data types
2. **Requirement 2 - Conflicts and Overrides**: Test conflict detection and specificity
3. **Requirement 3 - Scenario Evaluation**: Test rule matching and application
4. **Requirement 4 - Conflict Detection**: Test deterministic resolution
5. **Requirement 5 - Reasoning Path**: Test explanation generation
6. **Requirement 6 - Outcome Display**: Test result formatting
7. **Requirement 7 - No Auth**: Verify no auth checks
8. **Requirement 8 - Minimal UI**: Test data structure simplicity

### Test Approach
- Unit tests for rule engine logic
- Integration tests for API routes (future)
- Structural tests for UI requirements
- Determinism tests (multiple runs produce same results)

---

## Phase 5: Docker Integration

### Dockerfile Configuration
```dockerfile
- Base: Node 20-slim
- Install: npm dependencies
- Environment: MongoDB connection, test mode
- Default: Run tests
```

### Docker Compose Services
```yaml
- mongo: MongoDB 7 database
- app: Development server (port 3000)
- app-before: No implementation message
- app-after: Run tests
- evaluation: Generate reports
```

---

## Phase 6: Evaluation System

### Evaluation Script Features
1. **Test Execution**: Run Jest on both repositories
2. **Result Collection**: Parse test outcomes
3. **Report Generation**: Create JSON reports with:
   - Run metadata (ID, timestamps, environment)
   - Before/after test results
   - Comparison metrics (tests fixed, improvement %)
   - Success determination
4. **Timestamped Output**: Save reports in date/time directory structure

### Report Schema
```json
{
  "run_id": "uuid",
  "started_at": "ISO-8601",
  "finished_at": "ISO-8601",
  "duration_seconds": 0.0,
  "environment": {...},
  "before": {...},
  "after": {...},
  "comparison": {...},
  "success": true/false
}
```

---

## Phase 7: Implementation Details

### Key Challenges & Solutions

**Challenge 1**: Deterministic Conflict Resolution
- **Solution**: Use specificity (condition count) as tiebreaker
- **Additional**: Sort rules consistently before evaluation

**Challenge 2**: Explainable Reasoning
- **Solution**: Track all decisions and overrides
- **Additional**: Generate step-by-step reasoning path

**Challenge 3**: Flexible Condition Matching
- **Solution**: Use object key-value matching
- **Additional**: Support different data types (boolean, string, number)

**Challenge 4**: Minimal UI Without Auth
- **Solution**: Single-page app with simple forms
- **Additional**: Focus on functionality over aesthetics

**Challenge 5**: MongoDB Integration
- **Solution**: Connection pooling with proper error handling
- **Additional**: Environment-based configuration

---

## Phase 8: Verification Results

### Expected Outcomes

**repository_before**:
- No implementation (empty)
- All tests fail or skip
- Error: "No implementation found"

**repository_after**:
- Complete implementation with:
  - Rule engine logic (200+ lines)
  - API routes for CRUD and evaluation
  - Minimal UI for interaction
  - MongoDB integration
- All 8 requirement groups pass (30+ tests)
- Full requirement coverage:
  ✓ Rule creation with conditions/consequences
  ✓ Conflict detection and override logic
  ✓ Scenario evaluation with all relevant rules
  ✓ Deterministic conflict resolution
  ✓ Reasoning path generation
  ✓ Outcome display with explanation
  ✓ No authentication required
  ✓ Minimal, functional UI

### Quality Metrics
- **Test Coverage**: 100% of functional requirements
- **Code Quality**: TypeScript with strong typing
- **Error Handling**: Graceful failures with informative messages
- **Performance**: Fast evaluation even with many rules
- **Compatibility**: Works in Docker environment

---

## Conclusion

Successfully created a complete rule engine system that:
1. Allows users to define custom IF-THEN rules
2. Detects and resolves conflicts deterministically
3. Evaluates scenarios by applying relevant rules
4. Provides transparent reasoning paths
5. Displays clear outcomes and explanations
6. Works without authentication
7. Has a minimal, functional interface
8. Stores rules persistently in MongoDB

The implementation passes all requirement-based tests and is ready for AI training dataset use.
