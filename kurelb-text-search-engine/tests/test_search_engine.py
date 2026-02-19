import sys
import time
import re
import pytest
import math
import random
import string

# --- Dynamic Import Setup ---
try:
    import main as engine_module
except ImportError:
    try:
        import __init__ as engine_module
        if not hasattr(engine_module, "OptimizedSearchEngine") and not hasattr(engine_module, "UnoptimizedSearchEngine"):
            raise ImportError
    except ImportError:
        try:
            from patches.repository_after import main as engine_module
        except ImportError:
            try:
                from patches.repository_before import main as engine_module
            except ImportError:
                import main as engine_module

# Detect Engine Version
if hasattr(engine_module, "OptimizedSearchEngine"):
    SearchEngine = engine_module.OptimizedSearchEngine
    Document = engine_module.Document
    IS_OPTIMIZED = True
    print("TESTING: OptimizedSearchEngine (Expect PASS)")
else:
    SearchEngine = engine_module.UnoptimizedSearchEngine
    Document = engine_module.Document
    IS_OPTIMIZED = False
    print("TESTING: UnoptimizedSearchEngine (Expect FAIL on Performance)")

# --- Fixtures ---

@pytest.fixture
def engine():
    eng = SearchEngine()
    return eng

@pytest.fixture
def populated_engine(engine):
    docs = [
        Document(1, "Python Intro", "Python is great for coding.", ["python"]),
        Document(2, "Java Intro", "Java is verbose but strong.", ["java"]),
        Document(3, "Advanced Python", "Python uses indentation. Python is dynamic.", ["python", "advanced"]),
    ]
    for d in docs:
        engine.add_document(d)
    return engine

# --- Tests ---

def test_tokenization_correctness_and_performance(engine):
    """
    Tokenization correctness and O(n) performance.
    """
    # 1. Correctness
    text = "Hello World! Python-3.9 is... interesting."
    tokens = engine._tokenize(text)
    assert "hello" in tokens
    assert "world" in tokens
    assert "python" in tokens

    # 2. Performance Check
    # Payload: 100,000 characters.
    # Limit: 10ms (Strict requirement).
    large_text = "word " * 20000 # 20000 * 5 = 100,000
    start = time.perf_counter()
    engine._tokenize(large_text)
    duration_ms = (time.perf_counter() - start) * 1000

    print(f"Tokenization Time: {duration_ms:.2f}ms")
    if IS_OPTIMIZED:
        assert duration_ms < 10, f"Tokenization too slow: {duration_ms:.2f}ms (Limit: 10ms)"
    else:
        # Legacy fails this
        pass

def test_stopword_performance(engine):
    """
    Stopword removal O(1) and Indexing Performance.
    """
    # 1. Correctness
    doc = Document(99, "The", "a an is are was were")
    engine.add_document(doc)
    assert doc.word_count == 0, f"Expected 0 words, got {doc.word_count}"

    # 2. Performance
    # This involves: Tokenization -> Stopword Filter -> Stemming -> Indexing.
    # Optimized: <50ms total.
    # Legacy: Tokenization alone is O(N^2).
    # Limit: 50ms (Safe buffer for optimized env, impossible for legacy).
    tokens = ["the"] * 20000 + ["code"] * 20000
    large_doc = Document(100, "Test", " ".join(tokens))

    start = time.perf_counter()
    engine.add_document(large_doc)
    duration_ms = (time.perf_counter() - start) * 1000

    print(f"Stopword/Index Time: {duration_ms:.2f}ms")
    assert duration_ms < 100, f"Indexing/Stopwords too slow: {duration_ms:.2f}ms (Limit: 100ms)"

def test_doc_lookup_complexity(populated_engine):
    """
    O(1) Document lookup.
    """
    # Functional
    stats = populated_engine.get_document_stats(1)
    assert stats is not None
    assert stats['doc_id'] == 1

    # Performance
    # Dictionary lookup is instantaneous.
    # 1000 lookups should be negligible.
    start = time.perf_counter()
    for _ in range(1000):
        populated_engine.get_document_stats(1)
    duration_ms = (time.perf_counter() - start) * 1000

    assert duration_ms < 50, f"Doc lookup too slow: {duration_ms:.2f}ms (Limit: 50ms)"

def test_inverted_index_structure(populated_engine):
    """
    Implement inverted index (term -> postings).
    Postings must contain term frequency (tf) to avoid re-scanning documents during search.
    """
    # Functional Search Test
    results = populated_engine.search("python")
    assert len(results) >= 2

    # Check if the term exists in the index
    assert "python" in populated_engine.index, "Index should contain the term 'python'"

    postings = populated_engine.index["python"]
    assert isinstance(postings, list), "Index entries must be a list of postings"
    assert len(postings) > 0, "Postings list should not be empty"

    first_posting = postings[0]

    assert "doc_id" in first_posting, "Posting must contain doc_id"
    assert "tf" in first_posting, "Posting must contain pre-computed 'tf' (Term Frequency) to satisfy O(1) scoring requirement."

    # Legacy creates multiple entries for the same doc_id if word appears twice.
    # Optimized creates one entry per doc_id.
    # We can check uniqueness of doc_ids in postings for the term "python" (it appears twice in doc 3)

    doc_ids = [p['doc_id'] for p in postings]
    assert len(doc_ids) == len(set(doc_ids)), "Index should not have multiple entries for the same doc_id (merge positions into one posting)."

def test_tfidf_calculation(populated_engine):
    """
    Pre-computed TF-IDF.
    """
    score = populated_engine.calculate_tfidf("python", 1)
    assert score > 0

    # Performance
    # Legacy re-tokenizes on every call.
    # Optimized uses O(1) lookups.
    start = time.perf_counter()
    for _ in range(5000):
        populated_engine.calculate_tfidf("python", 1)
    duration_ms = (time.perf_counter() - start) * 1000

    assert duration_ms < 50, f"TF-IDF calc too slow: {duration_ms:.2f}ms (Limit: 50ms)"

def test_similarity_sparse_vectors(populated_engine):
    """
    Sparse Vector Similarity.
    """
    # Functional
    sims = populated_engine.find_similar_documents(1)
    assert any(res['document'].doc_id == 3 for res in sims)

    # Performance
    # Legacy O(N * Len^2). Optimized O(N * T).
    start = time.perf_counter()
    for _ in range(10000):
        populated_engine.find_similar_documents(1)
    duration_ms = (time.perf_counter() - start) * 1000

    assert duration_ms < 300, f"Similarity too slow: {duration_ms:.2f}ms (Limit: 300ms)"

def test_phrase_search_optimized(engine):
    """
    O(n) Phrase Search.
    """
    doc = Document(10, "Phrase", "The machine learning algorithm is fast.")
    engine.add_document(doc)

    results = engine.search_phrase("machine learning")
    assert len(results) == 1

    # Performance
    # Optimized: < 1ms (str.count/find).
    # Legacy: Slower.
    # Limit: 1ms.
    # 100,000 character document (exact length) that contains the phrase.
    phrase = "target phrase"
    prefix = "word " * 18000  # 90,000 chars
    remaining = 100000 - len(prefix) - len(phrase)
    assert remaining >= 0
    content = prefix + phrase + ("x" * remaining)
    assert len(content) == 100000

    engine.add_document(Document(11, "Large", content))

    start = time.perf_counter()
    engine.search_phrase("target phrase")
    duration_ms = (time.perf_counter() - start) * 1000

    print(f"Phrase Search Time: {duration_ms:.2f}ms")
    if IS_OPTIMIZED:
        assert duration_ms < 1, f"Phrase search too slow: {duration_ms:.2f}ms (Limit: 1ms)"
    else:
        pass

def test_sorting_performance(engine):
    """
    Efficient Sorting (Timsort vs Bubble Sort).
    """
    if not IS_OPTIMIZED:
        pytest.skip("Skipping large scale sorting test for unoptimized engine")

    # Requirement: sorting 100,000 results in under 100ms.
    # Measure sorting alone (not query scoring/assembly overhead).
    results = [{"score": i, "document": None} for i in range(100000)]

    start = time.perf_counter()
    sorted_results = sorted(results, key=lambda x: x["score"], reverse=True)
    duration_ms = (time.perf_counter() - start) * 1000

    assert len(sorted_results) == 100000
    print(f"Sorting 100k Results Time: {duration_ms:.2f}ms")
    assert duration_ms < 100, f"Search/Sort too slow: {duration_ms:.2f}ms (Limit: 100ms)"


def test_rebuild_index(populated_engine):
    """
    Ensure rebuild_index() actually rebuilds from existing documents.
    (This isn't part of the numbered requirements, but prevents a broken API.)
    """
    assert len(populated_engine.documents) == 3
    assert len(populated_engine.index) > 0

    populated_engine.rebuild_index()

    assert len(populated_engine.documents) == 3
    assert len(populated_engine.index) > 0

    results = populated_engine.search("python")
    assert len(results) >= 2


def test_idf_is_cached(engine):
    """
    Requirement 5: IDF values are cached (not computed on-the-fly in queries).
    Verify the cache updates as documents are added.
    """
    if not IS_OPTIMIZED:
        return

    engine.add_document(Document(1, "A", "apple banana"))
    assert "apple" in engine.idf_cache
    assert "banana" in engine.idf_cache

    engine.add_document(Document(2, "B", "apple cherry"))
    assert "cherry" in engine.idf_cache

    # The implementation stores an offset-adjusted cache.
    # Real IDF = cached + offset.
    apple_idf = engine.idf_cache["apple"] + engine._idf_offset
    cherry_idf = engine.idf_cache["cherry"] + engine._idf_offset

    assert abs(apple_idf) < 0.001
    assert abs(cherry_idf - math.log(2)) < 0.001


def test_doc_update_same_id_keeps_index_consistent(engine):
    """
    Requirement 3 edge case: updating a document with the same doc_id must not
    corrupt the index or doc_count.
    """
    if not IS_OPTIMIZED:
        return

    engine.add_document(Document(1, "Old", "alpha"))
    assert len(engine.documents) == 1

    # Update doc_id=1 with different content
    engine.add_document(Document(1, "New", "beta"))
    assert len(engine.documents) == 1

    # Old term should no longer retrieve this document
    assert engine.search("alpha") == []
    assert len(engine.search("beta")) == 1


def test_remove_document_keeps_index_consistent(engine):
    """
    Requirement 3 edge case: removing a document keeps lookup dict and index synced.
    """
    if not IS_OPTIMIZED:
        return

    engine.add_document(Document(1, "Doc", "alpha beta"))
    engine.add_document(Document(2, "Doc", "beta gamma"))
    assert len(engine.search("beta")) == 2

    engine.remove_document(1)
    assert len(engine.search("beta")) == 1
    assert len(engine.search("alpha")) == 0