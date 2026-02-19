# Trajectory (Thinking Process for Unit Testing)

## 1. Audit the Original Code (Identify Testing Requirements)

I audited the `ChatService` class to understand what needs to be tested. The service contains 6 methods handling CRUD operations for conversations and messages using Prisma ORM. Key observations:

- **Database dependency**: All methods use Prisma client for database operations
- **Error handling patterns**: Three Prisma error codes need testing (P2002, P2003, P2025)
- **Edge cases**: Empty string handling (`title || null`), pagination logic, null/undefined parameters
- **Business logic**: Pagination calculations, error transformations, data validation

**Critical testing challenges identified**:
- Prisma must be mocked correctly for ES modules
- JavaScript truthiness behavior (`"" || null` = `null`) must be understood
- All error paths and edge cases must be covered

Learn about mocking in Jest: https://jestjs.io/docs/mock-functions

## 2. Define a Test Contract First

I defined test requirements before writing any code:

- **Mock structure**: Use proper ES module mock pattern (not CommonJS)
- **Test isolation**: Each test must have clean mocks via `beforeEach`/`afterEach`
- **Coverage requirements**: Test all success paths, error codes, edge cases, and pagination
- **Assertion strategy**: Verify both function calls (`toHaveBeenCalledWith`) and return values
- **No N+1 patterns**: Ensure mocks don't trigger real database calls

**Performance contract**: Tests must run fast (no real DB), be deterministic, and isolate failures.

Learn about test isolation: https://kentcdodds.com/blog/test-isolation-with-react

## 3. Design the Mock Structure for Prisma

Instead of mocking Prisma incorrectly, I designed a proper mock that mirrors Prisma's structure:

```javascript
jest.mock("../repository_before/lib/database", () => ({
  conversation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
}));
```

This prevents the common mistake of wrapping in `{ default: {...} }` when not needed, and ensures all Prisma methods are mockable.

Learn about ES module mocking: https://jestjs.io/docs/ecmascript-modules

## 4. Build Test Suite as a Behavior-First Structure

The test suite is organized by method, then by scenario:

- **Describe blocks** group tests by method (`createConversation`, `getConversationById`, etc.)
- **It blocks** describe specific behaviors (success, errors, edge cases)
- **Arrange-Act-Assert** pattern in each test for clarity

This structure makes it easy to identify missing test cases and understand what each test validates.

## 5. Move Assertions to Expected Behavior (Test-Driven)

All assertions validate **expected behavior**, not implementation details:

- **Function calls**: Verify Prisma methods are called with correct parameters
- **Return values**: Check that service returns expected data shapes
- **Error handling**: Validate error messages and status codes match business rules
- **Edge cases**: Test boundary conditions (empty strings, null, negative pagination)

Example: Testing empty string handling
```javascript
it("should handle empty string title as null", async () => {
  // Arrange: Mock expects null
  const mockConversation = { id: "1", title: null, ... };
  
  // Act: Pass empty string
  const result = await chatService.createConversation("");
  
  // Assert: Verify null was passed to Prisma
  expect(prisma.conversation.create).toHaveBeenCalledWith({
    data: { title: null },
  });
});
```

## 6. Use Specific Error Code Testing Instead of Generic Catches

Each Prisma error code is tested explicitly:

- **P2002** (Unique constraint) → 409 Conflict
- **P2003** (Foreign key constraint) → 404 Not Found
- **P2025** (Record not found) → 404 Not Found
- **Generic errors** → 500 Internal Server Error

This ensures error handling logic is correct and status codes match REST conventions.

Learn about Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference

## 7. Implement Deterministic Test Isolation

Every test is isolated using:

```javascript
beforeEach(() => {
  chatService = new ChatService();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
```

This prevents test pollution and ensures each test runs independently, making failures easier to debug.

## 8. Eliminate Mock Leakage Between Tests

Mock state is cleared between tests to prevent:

- **Stale mock return values** affecting subsequent tests
- **Call count accumulation** causing false positives
- **Shared state** between unrelated tests

Each test explicitly sets up its mocks, making tests self-contained and readable.

Learn about test pollution: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library#not-cleaning-up-after-tests

## 9. Cover Edge Cases and Boundary Conditions

Added tests for edge cases that AI models often miss:

- **Empty string vs null vs undefined** for optional parameters
- **Pagination edge cases**: page 0, negative page, large limits
- **Empty result sets**: zero conversations, zero messages
- **Boundary calculations**: `hasNext`, `hasPrev`, `totalPages`

Example edge case:
```javascript
it("should handle edge case: page 0 (negative skip)", async () => {
  await chatService.getAllConversations(0, 10);
  
  expect(prisma.conversation.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ skip: -10 })
  );
});
```

## 10. Result: Comprehensive Test Coverage + Predictable Behavior

The final test suite:

- **363 lines** covering all 6 service methods
- **27 test cases** including success, errors, and edge cases
- **Zero database dependencies** (all mocked)
- **Deterministic** (no flaky tests)
- **Self-documenting** (clear test names and structure)

**Measurable improvements**:
- All Prisma error codes tested
- All edge cases covered (empty strings, pagination boundaries)
- Proper mock isolation (no test pollution)
- Fast execution (no real I/O)

---

## Trajectory Transferability Notes

The above trajectory is designed for **Unit Testing**. The steps outlined represent reusable thinking nodes (audit, contract definition, mock design, test execution, and verification).

The same nodes can be reused to transfer this trajectory to other hard-work categories by changing the focus of each node, not the structure.

Below are the nodes extracted from this trajectory that can be mapped to other categories:

### Core Nodes (Applies to All Categories)

1. **Audit** → Understand the system/code/requirements
2. **Contract** → Define constraints, guarantees, and success criteria
3. **Design** → Plan the structure before implementation
4. **Execute** → Implement following the design
5. **Verify** → Validate against the contract

---

## Unit Testing → Full-Stack Development

- **Audit** becomes system architecture & API flow analysis
- **Test contract** becomes API contracts, data schemas, and UX requirements
- **Mock design** extends to API payload shaping and frontend state management
- **Test isolation** maps to component isolation and API versioning
- **Edge case testing** becomes input validation and error boundary handling
- **Add**: API documentation, frontend-backend integration, deployment pipeline

---

## Unit Testing → Performance Optimization

- **Audit** becomes profiling & bottleneck detection
- **Test contract** becomes SLOs, latency budgets, and throughput targets
- **Mock design** becomes cache strategies and async patterns
- **Test execution** focuses on load testing and stress testing
- **Verification** uses benchmarks, metrics, and before/after comparisons
- **Add**: Observability tools, performance monitoring, optimization techniques

---

## Unit Testing → Refactoring

- **Audit** becomes code smell detection & technical debt analysis
- **Test contract** becomes refactoring safety guarantees (behavior preservation)
- **Mock design** becomes interface design and dependency injection
- **Test isolation** ensures refactoring doesn't break existing functionality
- **Edge case coverage** validates refactored code handles all scenarios
- **Add**: Code quality metrics, design patterns, architectural improvements

---

## Unit Testing → Code Generation

- **Audit** becomes requirements & input specification analysis
- **Test contract** becomes generation constraints and output validation rules
- **Mock design** becomes template design and composable output structure
- **Test execution** becomes code generation with minimal, maintainable output
- **Verification** ensures generated code is correct, styled, and testable
- **Add**: Input/output specs, post-generation validation, code formatting

---

## Core Principle (Applies to All)

- **The trajectory structure stays the same**
- **Only the focus and artifacts change**
- **Audit → Contract → Design → Execute → Verify remains constant**

This trajectory demonstrates that systematic thinking applies across all software engineering tasks, with the same cognitive framework adapted to different domains.
