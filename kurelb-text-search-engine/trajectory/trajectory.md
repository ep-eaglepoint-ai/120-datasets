# Trajectory – Text Search Engine Optimization

## 1. Audit the Original Code (Identify Scaling Problems)

I audited the original code (`repository_before`) and identified severe algorithmic bottlenecks that caused the system to fail under load:

- **String Concatenation in Loops**
  Tokenization was built character-by-character using `+`, creating **O(N²)** complexity.

- **Linear Scans for Lookups**

  - Documents stored in a list → **O(N)** scan to find document by ID
  - Stopwords checked via list iteration → **O(T × S)** per token

- **Redundant Computation**
  TF-IDF statistics and document vectors were re-calculated from scratch on every query and similarity check.

- **Naive Sorting**
  Results ranked using Bubble Sort → **O(N²)**

- **Naive Phrase Search**
  Used nested loops to check substrings → **O(N × M)**

**Verification Signal:**
The unoptimized code failed performance tests:

## 2. Define a Performance Contract First

Before writing any code, I defined strict performance constraints to ensure scalability to **100,000+ documents**:

- **Complexity Cap**

  - String processing must be **O(N)**
  - Lookups must be **O(1)**
  - Sorting must be **O(N log N)**

- **Data Structure Requirement**
  - No re-tokenization during search
  - All statistics must be pre-computed

## 3. Rework the Data Model for Efficiency

Completely restructured data storage, moving away from list-based naïve design:

- **Inverted Index**
  `self.index = defaultdict(list)` → term → [Postings]
  → Enables **O(1)** retrieval of relevant documents (no full corpus scan)

- **Document Store**
  Changed `self.documents` from list → dict (ID → Document)
  → **O(1)** lookup by ID

- **Pre-computed Vectors**
  - `self.doc_vectors`: sparse term frequency maps (created at indexing time)
  - `self.doc_magnitudes`: Euclidean norms (pre-calculated)

## 4. Rebuild the Search as an Index-First Pipeline

Rewrote search pipeline to only touch essential data:

1. Tokenize query → **O(Q)**
2. Lookup postings lists → **O(1)** per term
3. Score **only** candidate documents that contain query terms
   (no iteration over entire corpus)

## 5. Move Filters to Efficient Structures (Set Theory)

- **Stopwords**
  Converted list → `frozenset` → hash lookup **O(1)** instead of **O(S)**

- **Tokenization**
  Replaced manual character loops with `re.findall(r'\w+', text)`
  → delegates work to highly optimized C regex engine

## 6. Use Intersection Instead of Brute Force (Phrase Search)

Eliminated brute-force substring scanning:

- **Candidate Filtering**
  Used set intersection (`&`) on document IDs of all query terms
  → Early discard of documents missing any term

- **Optimized Matching**
  For surviving candidates: used Python's `str.find()` / `str.count()`
  (Boyer–Moore / highly optimized C implementation)

## 7. Stable Ordering + Efficient Sorting

Replaced manual Bubble Sort with production-grade alternatives:

- **General search**
  `sorted(results, key=..., reverse=True)` → Timsort **O(N log N)**

- **Top-K queries** (suggestions, similarity)
  `heapq.nlargest(10, ...)` → fixed-size heap, avoids full sort

## 8. Eliminate N+1 Computations (Caching)

Removed repeated calculations during search:

- **Cached Stemming**
  `self.stem_cache` → avoids re-stemming common words

- **Cached IDF**
  `self.doc_freqs` → global document frequencies computed once at indexing

- **Cached Magnitudes**
  Pre-calculated during `add_document` → cosine similarity reduced to dot product

## 9. Verification and Results

Verified with comprehensive test suite (`tests/test_search_engine.py`)
Legacy vs Optimized implementations compared side-by-side.

**Status:**

- `repository_after` passes all performance contracts
- `repository_before` correctly fails scalability tests
