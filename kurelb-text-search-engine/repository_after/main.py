import re
import time
import math
import heapq
from collections import defaultdict, Counter

class Document:
    def __init__(self, doc_id, title, content, tags=None):
        self.doc_id = doc_id
        self.title = title
        self.content = content
        self.tags = tags if tags else []
        self.word_count = 0
        self.indexed_at = None

class OptimizedSearchEngine:
    # Stopwords as frozenset for O(1) membership testing
    STOPWORDS = frozenset([
        "the", "a", "an", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will",
        "would", "could", "should", "may", "might", "must", "shall",
        "can", "need", "dare", "ought", "used", "to", "of", "in",
        "for", "on", "with", "at", "by", "from", "as", "into",
        "through", "during", "before", "after", "above", "below",
        "between", "under", "again", "further", "then", "once",
        "here", "there", "when", "where", "why", "how", "all",
        "each", "few", "more", "most", "other", "some", "such",
        "no", "nor", "not", "only", "own", "same", "so", "than",
        "too", "very", "just", "and", "but", "if", "or", "because",
        "until", "while", "this", "that", "these", "those"
    ])

    # Pre-compiled regex for O(n) tokenization
    TOKEN_PATTERN = re.compile(r'\w+')

    def __init__(self):
        # Dictionary for O(1) document lookup
        self.documents = {}

        # Inverted Index mapping stemmed terms to postings
        # Posting: {'doc_id': int, 'tf': int, 'pos': List[int]}
        self.index = defaultdict(list)

        # Pre-computed Sparse Vectors and Magnitudes for Similarity
        self.doc_vectors = {}      # doc_id -> {term: count}
        self.doc_magnitudes = {}   # doc_id -> float

        # Stats for TF-IDF
        self.doc_freqs = defaultdict(int) # term -> num_docs_containing_term
        # IDF caching without per-query recomputation.
        # We maintain a global offset that accounts for changes in N (doc count)
        # so we only update per-term cache entries for terms that appear in the
        # newly indexed document.
        self.idf_cache = {}  # term -> (log(N/df) - _idf_offset)
        self._doc_count = 0
        self._idf_offset = 0.0

        self.search_history = []
        self.stem_cache = {}

    def _tokenize(self, text):
        # Use regex findall and built-in lower() for O(n) performance
        if not text:
            return []
        return self.TOKEN_PATTERN.findall(text.lower())

    def _stem_word(self, word):
        # Cache stems for optimization
        if word in self.stem_cache:
            return self.stem_cache[word]

        original = word
        # Logic preserved from original, implemented with fast string slicing
        if len(word) > 4:
            if word.endswith("ing"): word = word[:-3]
            elif word.endswith("ed"): word = word[:-2]
            elif word.endswith("ly"): word = word[:-2]
            elif word.endswith("tion"): word = word[:-4]
            elif word.endswith("ness"): word = word[:-4]
            elif word.endswith("ment"): word = word[:-4]
            elif word.endswith("able"): word = word[:-4]
            elif word.endswith("ible"): word = word[:-4]
            elif word.endswith("ful"): word = word[:-3]
            elif word.endswith("less"): word = word[:-4]
            elif word.endswith("er"): word = word[:-2]
            elif word.endswith("est"): word = word[:-3]
            elif word.endswith("ity"): word = word[:-3]
            elif word.endswith("ous"): word = word[:-3]
            elif word.endswith("ive"): word = word[:-3]
            elif word.endswith("es"): word = word[:-2]
            elif word.endswith("s") and not word.endswith("ss"): word = word[:-1]

        self.stem_cache[original] = word
        return word

    def add_document(self, doc):
        # If doc_id already exists, treat this as an update (N unchanged).
        is_update = doc.doc_id in self.documents
        if is_update:
            self._remove_document(doc.doc_id, adjust_doc_count=False)

        # Update global doc count / IDF offset for new documents only.
        if not is_update:
            old_n = self._doc_count
            new_n = old_n + 1
            self._doc_count = new_n
            if old_n > 0:
                # All IDFs change by log(new_n/old_n) when N changes.
                self._idf_offset += math.log(new_n / old_n)
        else:
            new_n = self._doc_count

        # Store in dictionary
        self.documents[doc.doc_id] = doc
        doc.indexed_at = time.time()

        # Tokenize fields (including tags to ensure they are searchable)
        title_tokens = self._tokenize(doc.title)
        content_tokens = self._tokenize(doc.content)
        tag_tokens = []
        for tag in doc.tags:
            tag_tokens.extend(self._tokenize(tag))

        all_tokens = title_tokens + content_tokens + tag_tokens

        # Filter with list comprehension and set membership
        filtered_tokens = [t for t in all_tokens if t not in self.STOPWORDS]
        stemmed_tokens = [self._stem_word(t) for t in filtered_tokens]
        doc.word_count = len(stemmed_tokens)

        # Build Inverted Index and Pre-compute Counts
        term_counts = Counter(stemmed_tokens)

        # Track positions for exact phrase matching support
        term_positions = defaultdict(list)
        for idx, term in enumerate(stemmed_tokens):
            term_positions[term].append(idx)

        # Update global stats
        doc_vector = {}
        sq_sum = 0.0

        for term, count in term_counts.items():
            self.index[term].append({
                'doc_id': doc.doc_id,
                'tf': count,
                'pos': term_positions[term]
            })
            self.doc_freqs[term] += 1

            # Cache IDF for this term, adjusted by the global offset.
            df = self.doc_freqs[term]
            idf_real = math.log(new_n / df) if df > 0 else 0.0
            self.idf_cache[term] = idf_real - self._idf_offset

            # Store sparse vector data
            doc_vector[term] = count
            sq_sum += count * count

        self.doc_vectors[doc.doc_id] = doc_vector
        self.doc_magnitudes[doc.doc_id] = math.sqrt(sq_sum)

    def _remove_document(self, doc_id, *, adjust_doc_count=True):
        doc = self.documents.get(doc_id)
        if not doc:
            return

        old_vector = self.doc_vectors.get(doc_id, {})

        # Remove postings and update DF/IDF for affected terms.
        for term in list(old_vector.keys()):
            postings = self.index.get(term)
            if postings is not None:
                self.index[term] = [p for p in postings if p.get('doc_id') != doc_id]
                if not self.index[term]:
                    del self.index[term]

            if term in self.doc_freqs:
                self.doc_freqs[term] -= 1
                if self.doc_freqs[term] <= 0:
                    del self.doc_freqs[term]
                    self.idf_cache.pop(term, None)
                else:
                    # Recompute cached value for this term (N may be adjusted below).
                    pass

        # Remove per-doc data.
        self.doc_vectors.pop(doc_id, None)
        self.doc_magnitudes.pop(doc_id, None)
        self.documents.pop(doc_id, None)

        # Adjust N/offset if requested.
        if adjust_doc_count:
            old_n = self._doc_count
            new_n = max(0, old_n - 1)
            self._doc_count = new_n

            if new_n == 0:
                # Everything should be empty now.
                self._idf_offset = 0.0
            elif old_n > 0:
                self._idf_offset += math.log(new_n / old_n)

        # Recompute IDF cache entries for terms that still exist in doc_freqs.
        n = self._doc_count
        if n > 0:
            for term in old_vector.keys():
                df = self.doc_freqs.get(term)
                if df:
                    idf_real = math.log(n / df)
                    self.idf_cache[term] = idf_real - self._idf_offset

    def remove_document(self, doc_id):
        self._remove_document(doc_id, adjust_doc_count=True)

    def search(self, query):
        # Append to list instead of string concatenation
        self.search_history.append(query)

        query_tokens = self._tokenize(query)
        filtered_query = [t for t in query_tokens if t not in self.STOPWORDS]
        stemmed_query = [self._stem_word(t) for t in filtered_query]

        if not stemmed_query:
            return []

        # Use Inverted Index and Pre-computed Stats
        scores = defaultdict(float)
        for term in stemmed_query:
            if term not in self.index:
                continue

            idf = self.idf_cache.get(term, 0.0) + self._idf_offset

            # Retrieve postings (O(1))
            postings = self.index[term]

            for posting in postings:
                doc_id = posting['doc_id']
                tf_raw = posting['tf']
                doc_len = self.documents[doc_id].word_count

                if doc_len > 0:
                    tf = tf_raw / doc_len
                    scores[doc_id] += (tf * idf * 100)

        results = []
        for doc_id, score in scores.items():
            results.append({"document": self.documents[doc_id], "score": score})

        # Use sorted() (Timsort) O(n log n)
        return sorted(results, key=lambda x: x["score"], reverse=True)

    def search_phrase(self, phrase):
        # Efficient Phrase Search using Index Intersection + str.find
        self.search_history.append(f"PHRASE: {phrase}")

        phrase_tokens = self._tokenize(phrase)
        if not phrase_tokens:
            return []

        filtered_tokens = [t for t in phrase_tokens if t not in self.STOPWORDS]
        stemmed_tokens = [self._stem_word(t) for t in filtered_tokens]

        if not stemmed_tokens:
            return []

        # 1. Intersection: Find docs containing ALL terms (Fast filtering)
        candidate_ids = None
        for term in stemmed_tokens:
            if term not in self.index:
                return []
            term_docs = {p['doc_id'] for p in self.index[term]}
            if candidate_ids is None:
                candidate_ids = term_docs
            else:
                candidate_ids &= term_docs
            if not candidate_ids:
                return []

        # 2. Validation: Use str.find / str.count on candidates
        results = []
        phrase_lower = phrase.lower()

        for doc_id in candidate_ids:
            doc = self.documents[doc_id]

            # Use Python's built-in string methods (C-optimized)
            content_count = doc.content.lower().count(phrase_lower)
            title_count = doc.title.lower().count(phrase_lower)

            total_matches = content_count + title_count
            if total_matches > 0:
                # Weighted score based on matches
                score = content_count + (title_count * 3)
                results.append({
                    "document": doc,
                    "score": score,
                    "matches": total_matches
                })

        return sorted(results, key=lambda x: x["score"], reverse=True)

    def search_with_filters(self, query, filters):
        # Reuse optimized search
        results = self.search(query)
        filtered_results = []

        # Pre-process filters
        req_tags = set(t.lower() for t in filters.get("tags", []))
        title_contains = filters.get("title_contains", "").lower()
        min_words = filters.get("min_word_count", 0)
        max_words = filters.get("max_word_count", float('inf'))

        for res in results:
            doc = res["document"]

            if not (min_words <= doc.word_count <= max_words):
                continue

            if req_tags:
                doc_tags = {t.lower() for t in doc.tags}
                # Check if document has ANY of the required tags (based on original logic context)
                # or ALL? The original code checked each required tag and flagged if NOT found.
                # Logic: if "tag_found" is false for any required tag, break. -> It requires ALL.
                if not all(rt in doc_tags for rt in req_tags):
                    continue

            if title_contains:
                if title_contains not in doc.title.lower():
                    continue

            filtered_results.append(res)

        return filtered_results

    def get_suggestions(self, partial_query):
        partial_lower = partial_query.lower()
        suggestions = []

        # Scan inverted index keys
        for term, postings in self.index.items():
            if term.startswith(partial_lower):
                suggestions.append({"term": term, "doc_count": len(postings)})

        # Use heapq.nlargest for O(N log K) top-k selection
        return heapq.nlargest(10, suggestions, key=lambda s: s["doc_count"])

    def find_similar_documents(self, doc_id):
        # Optimized Similarity using Sparse Vectors
        if doc_id not in self.documents:
            return []

        # O(1) Vector Lookup
        target_vector = self.doc_vectors.get(doc_id)
        target_mag = self.doc_magnitudes.get(doc_id)

        if not target_vector or target_mag == 0:
            return []

        similarities = []

        # Iterate over docs (O(N)). Dot product is O(T) where T is terms in target.
        # Total Complexity: O(N*T), much faster than O(N*Length^2)
        for other_id, other_vector in self.doc_vectors.items():
            if other_id == doc_id:
                continue

            other_mag = self.doc_magnitudes[other_id]
            if other_mag == 0:
                continue

            # Sparse Dot Product
            dot_product = 0.0
            for term, count in target_vector.items():
                if term in other_vector:
                    dot_product += count * other_vector[term]

            if dot_product > 0:
                similarity = dot_product / (target_mag * other_mag)
                similarities.append({
                    "document": self.documents[other_id],
                    "similarity": similarity
                })

        return heapq.nlargest(10, similarities, key=lambda s: s["similarity"])

    def calculate_tfidf(self, term, doc_id):
        # O(1) lookup using pre-computed values
        doc = self.documents.get(doc_id)
        if not doc: return 0

        term_stemmed = self._stem_word(term.lower())

        # O(1) TF Lookup
        vector = self.doc_vectors.get(doc_id, {})
        raw_count = vector.get(term_stemmed, 0)
        tf = raw_count / doc.word_count if doc.word_count > 0 else 0

        # O(1) IDF Lookup
        idf = self.idf_cache.get(term_stemmed, 0.0) + self._idf_offset

        return tf * idf

    def get_document_stats(self, doc_id):
        # O(1) Doc lookup
        doc = self.documents.get(doc_id)
        if not doc: return None

        vector = self.doc_vectors.get(doc_id, {})

        # Built-in sort
        sorted_freq = sorted(vector.items(), key=lambda x: x[1], reverse=True)
        top_words = [{"word": w, "count": c} for w, c in sorted_freq[:20]]

        # Calculate stats
        # Re-tokenization allowed here as stats are requested infrequently,
        # or we could store token count in doc object.
        # Using _tokenize is O(N) which is fine for single doc stats.
        raw_tokens = self._tokenize(doc.content)
        avg_len = sum(len(t) for t in raw_tokens) / len(raw_tokens) if raw_tokens else 0

        return {
            "doc_id": doc_id,
            "total_words": doc.word_count,
            "unique_words": len(vector),
            "top_words": top_words,
            "avg_word_length": avg_len
        }

    def rebuild_index(self):
        # Restore documents
        docs_backup = list(self.documents.values())

        self.index.clear()
        self.documents.clear()
        self.doc_vectors.clear()
        self.doc_magnitudes.clear()
        self.doc_freqs.clear()
        self.idf_cache.clear()
        self._doc_count = 0
        self._idf_offset = 0.0
        self.search_history = []

        # Re-index
        for doc in docs_backup:
            self.add_document(doc)

    def get_index_stats(self):
        total_terms = len(self.index)
        total_postings = sum(len(p) for p in self.index.values())
        avg_postings = total_postings / total_terms if total_terms > 0 else 0
        return {
            "total_documents": len(self.documents),
            "total_terms": total_terms,
            "total_postings": total_postings,
            "avg_postings_per_term": avg_postings
        }

    def export_search_history(self):
        # Efficient string join
        return "\n".join(self.search_history) + "\n"