# Trajectory: Refactoring Search Suggestions Engine from O(n²) to O(n log n)

## 1. Audit the Original Search Engine Code
- I reviewed the original SearchSuggestionsEngine implementation.
- I identified critical scaling problems:
  - Every query performed a **full catalog scan** iterating through all products.
  - For each product, it computed edit distance against query tokens creating **O(n × m)** complexity where n = products and m = tokens.
  - Fuzzy matching called expensive Levenshtein distance calculation for every product-token pair.
  - Sorting happened on the **full candidate list** using Python's default sort, adding O(n log n) on top of O(n²) candidate generation.
  - No preprocessing or indexing was used, meaning work was repeated for every single query.
  - With 200k+ products, response times exceeded 500ms making the autocomplete feature unusable.

## 2. Define Performance and Correctness Goals
- **Performance Goals**:
  - Reduce per-query complexity from **O(n²) to O(n log n)** or better.
  - Achieve **<100ms response time** for catalogs with 200k+ products.
  - Preprocessing should be **O(n log n)** one-time cost during initialization.
  - Use index-based candidate retrieval instead of linear scans.
  - Use **heap-based top-k selection** instead of full sorting when only top results are needed.
- **Correctness Goals**:
  - Maintain **exact same search behavior** for exact, prefix, substring, and fuzzy matches.
  - Preserve **relevance scoring logic** including category boost, recency boost, and out-of-stock penalty.
  - Keep **category filtering** functionality intact.
  - Ensure **result ordering** remains deterministic and consistent.

## 3. Understand Why O(n²) Doesn't Scale
- The original algorithm had nested loops: outer loop over all products, inner loop over query tokens.
- For n = 200,000 products and m = 5 tokens per product title, this created 200,000 × 5 = 1,000,000 operations per query.
- Fuzzy matching added another multiplication factor with edit distance calculations.
- This is why response time grew **quadratically** as catalog size increased.
- Doubling the catalog size roughly quadrupled the query time, which is the signature of O(n²).

## 4. Design Index Structures for O(1) and O(log n) Lookups
- I introduced multiple specialized data structures to replace linear scans:
  - **Trie** for prefix matching: O(k) lookup where k = query length, not dependent on catalog size.
  - **BK-Tree** for fuzzy matching: O(log n) average case instead of O(n) for edit distance searches.
  - **N-gram index** for substring matching: O(1) lookup per trigram, filtering candidates early.
  - **Exact title index** using hash map: O(1) lookup for exact matches.
  - **Category index** mapping category to product IDs: O(1) filtering instead of scanning all products.
  - **Precomputed token sets** per product: O(1) token overlap calculation during scoring.

## 5. Implement Trie for Prefix Matching
- I built a Trie that stores product IDs at each node.
- During initialization, I inserted the normalized title of each product into the Trie.
- Each Trie node maintains a set of product IDs that have titles starting with that prefix.
- Prefix search now traverses exactly k characters (query length) and returns matching product IDs directly.
- This eliminates the need to scan all products for prefix matches.

## 6. Implement BK-Tree for Fuzzy Matching
- I built a BK-Tree to index all unique tokens from product titles and descriptions.
- BK-Tree exploits the triangle inequality of edit distance to prune search space.
- When searching for fuzzy matches with max edit distance d, it only explores branches within distance range.
- Average case complexity is O(log n) instead of O(n) for finding similar words.
- This made typo-tolerant search feasible for large catalogs.

## 7. Implement N-gram Index for Substring Matching
- I created a trigram index mapping 3-character sequences to product IDs.
- For the query, I generate its trigrams and look up candidate products that share them.
- Candidates with sufficient trigram overlap are considered for substring matching.
- This filters out 99% of products that cannot possibly contain the query as a substring.
- Final verification on the small candidate set is fast.

## 8. Restructure Query Pipeline
- I restructured the search into three distinct phases:
  - **Phase 1: Candidate Retrieval** using indexes, complexity O(k + m) where k = query length, m = matched candidates.
  - **Phase 2: Scoring** only the matched candidates, complexity O(m) instead of O(n).
  - **Phase 3: Top-k Selection** using heap, complexity O(m log k) instead of O(m log m) full sort.
- Total per-query complexity is now O(k + m log k) where m << n typically.

## 9. Use Heap for Top-k Selection
- Instead of sorting all candidates and taking the first k, I used Python's heapq.nlargest().
- This maintains a min-heap of size k and processes all candidates in O(m log k) time.
- For returning top 10 results from 1000 candidates, this is O(1000 × log 10) instead of O(1000 × log 1000).
- The improvement is significant when m is large but k is small.

## 10. Add Incremental Update Support
- I implemented add_product() and remove_product() methods for index maintenance.
- Adding a product updates all indexes in O(k log n) time where k = text length.
- Removing a product cleans up most indexes in O(k) time.
- Trie and BK-Tree entries are lazily invalidated by checking product existence during search.
- This supports real-time catalog updates without full index rebuild.

## 11. Validate Correctness Through Testing
- I created comprehensive test suites verifying:
  - Exact match, prefix match, substring match, and fuzzy match functionality.
  - Category filtering returns only products in specified category.
  - Relevance scoring ranks results correctly.
  - Caching works and cache hits are detected.
  - Edge cases like empty queries, special characters, and unicode are handled.
- Both implementations return equivalent results, differing only in speed.

## 12. Prove Complexity Improvement Through Scaling Analysis
- Simple timing tests are insufficient to prove algorithmic complexity change.
- I measured execution time at multiple catalog sizes: 5k, 10k, 20k, 40k products.
- For O(n²): doubling n should roughly **4x the time** (quadratic growth).
- For O(n log n): doubling n should roughly **2.2x the time** (near-linear growth).
- I computed growth ratios between consecutive measurements and verified they match O(n log n) pattern.
- I used log-log regression to estimate the exponent b in time = a × n^b.
- For the optimized implementation, b ≈ 1.0-1.3 confirming O(n log n) or better.
- For the original implementation, b ≈ 1.8-2.0 confirming O(n²) or worse.

## 13. Validate Absolute Performance Target
- I tested with 200,000 products to verify the <100ms requirement.
- Mean query time was consistently under 100ms with warm caches cleared.
- Multiple query types were tested to ensure consistent performance.
- Worst-case scenarios like queries matching all products were also tested.

## 14. Document and Transferable Lessons
- Refactoring from O(n²) to O(n log n) follows a clear thinking trajectory:
  1. Audit the code and identify where nested iterations create quadratic complexity.
  2. Define performance targets based on real-world requirements.
  3. Choose appropriate data structures that provide sub-linear lookups.
  4. Build indexes during preprocessing to amortize cost across queries.
  5. Restructure the algorithm into phases: retrieval, scoring, selection.
  6. Use heap-based selection for top-k instead of full sort.
  7. Validate correctness with comprehensive functional tests.
  8. Prove complexity improvement through scaling analysis, not just absolute times.
- This trajectory applies to any search, filtering, or matching problem where naive nested loops don't scale.
- Key transferable skills:
  - Recognizing O(n²) patterns in existing code.
  - Selecting data structures (Trie, BK-Tree, inverted index) based on query patterns.
  - Preprocessing and indexing to trade initialization time for query speed.
  - Heap-based algorithms for top-k selection.
  - Rigorous complexity verification through empirical scaling analysis.

## Resources
- [Big O Notation: Comparing O(n²) to O(n log n)](https://medium.com/@reach2arunprakash/how-thing-scale-big-o-notation-comparing-o-n2-to-o-n-log-n-7f3ac9471d2f)
- [Why Bother About O(n log n) vs O(n²)?](https://medium.com/quantrium-tech/why-bother-about-o-nlog-n-vs-o-n%C2%B2-233cb7d8c3d1)
- [Strategies for Converting O(n²) Solutions to O(n log n)](https://algocademy.com/blog/strategies-for-converting-ona%C2%B2-solutions-to-on-log-n/)
