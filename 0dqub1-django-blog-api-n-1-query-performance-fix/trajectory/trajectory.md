# Trajectory: Django Blog API N+1 Query Performance Fix

### 1. Phase 1: AUDIT / REQUIREMENTS ANALYSIS
**Guiding Question**: "What is the actual problem, not just the symptom?"

**Observations**:
The current implementation of the Blog API suffers from a massive N+1 query problem. For every post in the list, the API triggers additional queries to fetch:
- The author of the post.
- The category of the post.
- The tags associated with the post.
- The comments for each post (via `get_recent_comments` SerializerMethodField).
- The author of each individual comment.
- Annotations for `comment_count` and `tag_count`.

**Root Cause**: 
The `get_queryset` method in `PostViewSet` only fetches the base `Post` objects. When the `PostSerializer` accesses related fields (`author`, `category`, `tags`, `comments`), Django's ORM triggers a new query for each related instance per post. For a page size of 50, this leads to hundreds of queries.

**Constraints Analysis**:
- Query count must be < 10 and constant regardless of page size.
- Response time under 500ms for 50 posts.
- Preservation of JSON structure is critical.
- Preservation of -created_at ordering.

### 2. Phase 2: QUESTION ASSUMPTIONS (Challenge the Premise)
**Guiding Question**: "Why are we doing this? Is this the right approach?"

**Assumption**: Can we just use `prefetch_related` everywhere?
**Reality**: No. `select_related` is for "forward" ForeignKeys and OneToOne relationships (JOINs), while `prefetch_related` is for ManyToMany and reverse ForeignKeys (separate queries). Mixing them incorrectly or using `prefetch_related` where `select_related` is more efficient (JOIN) would lead to suboptimal performance.

**Assumption**: Is `SerializerMethodField` for comments the right choice?
**Reality**: While we can't change the serializer structure, we MUST optimize how that field's queryset is handled. Calling `obj.comments.all()[:3]` in the serializer is the primary source of N+1 for comments. We need to pre-fetch these at the queryset level.

### 3. Phase 3: DEFINE SUCCESS CRITERIA (Establish Measurable Goals)
**Guiding Question**: "What does 'better' mean in concrete, measurable terms?"

**Performance**:
- Before: ~2,500 queries for 200 posts.
- After: < 10 queries for 200 posts.

**Correctness**:
- JSON response parity (nested objects, field names).
- Pagination metadata must be accurate.
- Filtering by author and category must remain functional.

### 4. Phase 4: MAP REQUIREMENTS TO VALIDATION (Define Test Strategy)
**Guiding Question**: "How will we prove the solution is correct and complete?"

- **TC-01 (Query Count)**: Use `CaptureQueriesContext` to verify len(queries) < 10 for page sizes 50, 100, and 200. (FAIL_TO_PASS)
- **TC-02 (JSON Integrity)**: Compare keys and nested structures of the response. (PASS_TO_PASS)
- **TC-03 (Pagination)**: Verify offset/limit results and counts. (PASS_TO_PASS)
- **TC-04 (Filters)**: Test `?author=X` and verify it filters correctly without adding queries.
- **TC-05 (Ordering)**: Verify `-created_at` for both posts and nested comments.
- **TC-07 (Nested Prefetch)**: Verify that fetching comment authors doesn't trigger N+1. (FAIL_TO_PASS)

### 5. Phase 5: SCOPE THE SOLUTION
**Guiding Question**: "What is the smallest edit that achieves the goal?"

**Modifications**:
- `blog/views.py`: Complete rewrite of `get_queryset`.
  - Add `select_related('author', 'category')`.
  - Add `prefetch_related('tags')`.
  - Use `Prefetch` object for `comments` with an optimized queryset that also uses `select_related('author')`.
  - Ensure `Count('comments', distinct=True)` is used for annotations.

### 6. Phase 6: TRACE DATA/CONTROL FLOW (Follow the Path)
**Guiding Question**: "How does data/control flow change?"

**Before**:
Request → View Fetches Posts → Serializer Starts → Loop through Posts → Query for Author → Query for Category → Query for Tags → Query for Comments → Loop through Comments → Query for Comment Author → Next Post...

**After**:
Request → View Fetches Posts + (Joins) Author/Category → Separate Query for Tags for all Posts → Separate Query for Comments + (Joins) Author for all Posts → Serializer uses cached related objects → Response.

### 7. Phase 7: ANTICIPATE OBJECTIONS (Play Devil's Advocate)
**Objection**: "Won't prefetching all comments use too much memory?"
- **Counter**: We are using DRF pagination. `prefetch_related` only fetches related objects for the *current page* (e.g., 50 posts), not the whole table.
**Objection**: "Why use `distinct=True` in Count?"
- **Counter**: When joining with ManyToMany relationships or multiple reverse ForeignKeys, the base rows can multiply, leading to inflated counts. `distinct=True` ensures accurate results.

### 8. Phase 8: VERIFY INVARIANTS / DEFINE CONSTRAINTS
- **Must preserve**: API Contract (JSON structure).
- **Must improve**: Query complexity from O(N) to O(1).
- **Must not break**: Filtering functionality.

### 9. Phase 9: EXECUTE WITH SURGICAL PRECISION (Ordered Implementation)
1. **Infrastructure**: Setup virtual environment and install dependencies.
2. **Analysis**: Profile the existing code to identify exact N+1 points.
3. **Implementation**: Update `get_queryset` in `PostViewSet` with `select_related`, `prefetch_related`, and optimized `Prefetch` objects.
4. **Verification**: Run performance tests against both "before" and "after" repositories.

### 10. Phase 10: MEASURE IMPACT / VERIFY COMPLETION
- **Query Efficiency**: 100% reduction in relative complexity (Constant vs Linear).
- **Response Time**: Significant reduction in latency due to fewer DB roundtrips.
- **Contract Integrity**: Verified via structural tests.

### 11. Phase 11: DOCUMENT THE DECISION (Capture Context for Future)
**Problem**: Catastrophic N+1 queries in Blog API rendering it unusable for production.
**Solution**: Implemented eager loading at the queryset level using `select_related` for direct relationships and `Prefetch` objects for nested reverse relationships.
**Trade-offs**: Slightly more complex `get_queryset` in exchange for massive performance gains.
**When to revisit**: If nested comment depth increases or additional ManyToMany relationships are added.
