from typing import List, Set, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict
import time
import re
from enum import Enum

class ProductCategory(Enum):
    """Product category classifications"""
    ELECTRONICS = "electronics"
    CLOTHING = "clothing"
    BOOKS = "books"
    HOME_GARDEN = "home_garden"
    SPORTS = "sports"
    TOYS = "toys"
    FOOD = "food"
    BEAUTY = "beauty"

@dataclass
class Product:
    """Represents a product in the catalog"""
    product_id: str
    title: str
    description: str
    category: ProductCategory
    price: float
    rating: float  
    review_count: int
    in_stock: bool
    popularity_score: float  
    created_timestamp: float
    tags: List[str]
    
    def __hash__(self):
        return hash(self.product_id)
    
    def __eq__(self, other):
        if not isinstance(other, Product):
            return False
        return self.product_id == other.product_id

@dataclass
class SearchSuggestion:
    """A single search suggestion with relevance metadata"""
    product: Product
    relevance_score: float
    match_type: str  
    matched_fields: List[str]  
    highlight_positions: List[Tuple[int, int]]  
    
    def __hash__(self):
        return hash(self.product.product_id)

@dataclass
class SearchSuggestionsResult:
    """Result of search suggestion query"""
    suggestions: List[SearchSuggestion]
    total_candidates: int
    products_scanned: int
    query_time_ms: float
    cache_hit: bool
    
    def __eq__(self, other):
        if not isinstance(other, SearchSuggestionsResult):
            return False
        if len(self.suggestions) != len(other.suggestions):
            return False
        for s1, s2 in zip(self.suggestions, other.suggestions):
            if s1.product.product_id != s2.product.product_id:
                return False
            if abs(s1.relevance_score - s2.relevance_score) > 0.0001:
                return False
        return True

class SearchSuggestionsEngine:
    """
    Production search suggestions engine with O(n²) complexity bug.
    
    CRITICAL PERFORMANCE ISSUE: Uses nested loops for multi-pass filtering
    and scoring, resulting in catastrophic performance on large catalogs.
    """
    
    def __init__(self, catalog: List[Product], enable_profiling: bool = False):
        self.catalog = catalog
        self.enable_profiling = enable_profiling
        self.query_log: List[Dict[str, Any]] = []
        self._performance_stats = {
            'queries_processed': 0,
            'avg_response_time_ms': 0.0,
            'cache_hit_rate': 0.0,
            'products_scanned': 0,
            'index_size_bytes': 0
        }
        
        self._query_cache: Dict[str, SearchSuggestionsResult] = {}
        self._cache_hits = 0
        self._cache_misses = 0
    
    def _log_query_performance(self, query: str, phase: str, duration_ms: float):
        """Log performance metrics for analysis"""
        if self.enable_profiling:
            self.query_log.append({
                'query': query,
                'phase': phase,
                'duration_ms': duration_ms,
                'timestamp': time.time()
            })
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison (lowercase, strip, etc.)"""
        return re.sub(r'\s+', ' ', text.lower().strip())
    
    def _tokenize(self, text: str) -> List[str]:
        """Split text into searchable tokens"""
        normalized = self._normalize_text(text)
        tokens = re.findall(r'\w+', normalized)
        return tokens
    
    def _calculate_edit_distance(self, s1: str, s2: str) -> int:
        """
        Calculate Levenshtein edit distance.
        O(len(s1) × len(s2)) complexity - expensive!
        """
        if len(s1) < len(s2):
            return self._calculate_edit_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def _calculate_base_relevance_score(
        self,
        product: Product,
        query: str,
        match_type: str
    ) -> float:
        """
        Calculate base relevance score for a product.
        
        Score components:
        - Exact title match: 100 points
        - Prefix match: 75 points
        - Substring match: 50 points
        - Description match: 25 points
        - Tag match: 40 points
        """
        score = 0.0
        query_lower = query.lower()
        title_lower = product.title.lower()
        desc_lower = product.description.lower()
        
        if match_type == "exact" and query_lower == title_lower:
            score += 100.0
        elif match_type == "prefix" and title_lower.startswith(query_lower):
            score += 75.0
        elif match_type == "substring" and query_lower in title_lower:
            score += 50.0
        
        if query_lower in desc_lower:
            score += 25.0
        
        for tag in product.tags:
            if query_lower in tag.lower():
                score += 40.0
                break
        
        score += product.rating * 5.0  
        score += min(product.review_count / 100.0, 10.0)  
        score += product.popularity_score * 20.0  
        
        return score
    
    def _apply_category_boost(
        self,
        base_score: float,
        product: Product,
        query: str
    ) -> float:
        """
        Apply category-specific boosting.
        
        If query matches category name, boost relevance.
        """
        query_lower = query.lower()
        category_name = product.category.value.lower()
        
        if query_lower in category_name or category_name in query_lower:
            return base_score * 1.5
        
        return base_score
    
    def _apply_fuzzy_penalty(
        self,
        score: float,
        query: str,
        product_text: str,
        max_edit_distance: int = 2
    ) -> Tuple[float, bool]:
        """
        Apply penalty for fuzzy matches.
        
        Returns (adjusted_score, is_fuzzy_match)
        """
        query_tokens = self._tokenize(query)
        product_tokens = self._tokenize(product_text)
        
        fuzzy_matches = 0
        for q_token in query_tokens:
            for p_token in product_tokens:
                edit_dist = self._calculate_edit_distance(q_token, p_token)
                if edit_dist <= max_edit_distance:
                    fuzzy_matches += 1
                    break
        
        if fuzzy_matches > 0:
            penalty = fuzzy_matches * 0.9  
            return score * penalty, True
        
        return score, False
    
    def _calculate_recency_boost(self, product: Product) -> float:
        """Boost newer products"""
        current_time = time.time()
        age_days = (current_time - product.created_timestamp) / 86400.0
        
        if age_days < 30:
            return 1.2
        elif age_days < 90:
            return 1.1
        else:
            return 1.0
    
    def generate_search_suggestions(
        self,
        query: str,
        max_results: int = 10,
        enable_fuzzy: bool = True,
        category_filter: Optional[str] = None,
        min_score_threshold: float = 0.0
    ) -> SearchSuggestionsResult:
        """
        Generate search suggestions using NESTED LOOPS (O(n²) complexity).
        
        PERFORMANCE ISSUE: This implementation has catastrophic performance
        for large catalogs due to multiple nested iterations.
        
        Algorithm phases:
        1. Substring matching pass: O(n × k) where k = avg product text length
        2. Token-based scoring: O(n × m × t) where m = query tokens, t = product tokens
        3. Category boosting: O(n)
        4. Fuzzy matching: O(n × m × t × k²) due to edit distance calculations
        5. Sorting: O(n log n)
        
        Total complexity: O(n²) or worse with fuzzy matching enabled!
        
        Args:
            query: Search query string
            max_results: Maximum suggestions to return
            enable_fuzzy: Enable typo tolerance
            category_filter: Optional category to filter by
            min_score_threshold: Minimum relevance score to include
            
        Returns:
            SearchSuggestionsResult with ranked suggestions
        """
        start_time = time.time()
        
        cache_key = f"{query}|{max_results}|{enable_fuzzy}|{category_filter}|{min_score_threshold}"
        if cache_key in self._query_cache:
            self._cache_hits += 1
            result = self._query_cache[cache_key]
            result.cache_hit = True
            return result
        
        self._cache_misses += 1
        query_normalized = self._normalize_text(query)
        
        if not query_normalized:
            return SearchSuggestionsResult(
                suggestions=[],
                total_candidates=0,
                products_scanned=0,
                query_time_ms=0.0,
                cache_hit=False
            )
        
        phase1_start = time.time()
        candidates: List[Tuple[Product, str]] = [] 
        
        for product in self.catalog:
            self._performance_stats['products_scanned'] += 1
            
            if category_filter and product.category.value != category_filter:
                continue
            
            title_lower = product.title.lower()
            desc_lower = product.description.lower()
            
            match_type = None
            if query_normalized == title_lower:
                match_type = "exact"
            elif title_lower.startswith(query_normalized):
                match_type = "prefix"
            elif query_normalized in title_lower:
                match_type = "substring"
            elif query_normalized in desc_lower:
                match_type = "substring"
            else:
                for tag in product.tags:
                    if query_normalized in tag.lower():
                        match_type = "substring"
                        break
            
            if match_type:
                candidates.append((product, match_type))
        
        phase1_time = (time.time() - phase1_start) * 1000
        self._log_query_performance(query, "substring_matching", phase1_time)
        
        phase2_start = time.time()
        scored_suggestions: List[SearchSuggestion] = []
        query_tokens = self._tokenize(query_normalized)
        
        for product, match_type in candidates:
            
            base_score = self._calculate_base_relevance_score(
                product,
                query_normalized,
                match_type
            )
            
            product_text = f"{product.title} {product.description}"
            product_tokens = self._tokenize(product_text)
            
            token_overlap = 0
            for q_token in query_tokens:  
                for p_token in product_tokens:  
                    if q_token == p_token:
                        token_overlap += 1
                        break
            
            if query_tokens:
                overlap_ratio = token_overlap / len(query_tokens)
                base_score *= (1.0 + overlap_ratio)
            
            if not product.in_stock:
                base_score *= 0.5
            
            score_with_category = self._apply_category_boost(
                base_score,
                product,
                query_normalized
            )
            
            score_with_recency = score_with_category * self._calculate_recency_boost(product)
            
            final_score = score_with_recency
            actual_match_type = match_type
            
            if enable_fuzzy and match_type == "substring":
                fuzzy_score, is_fuzzy = self._apply_fuzzy_penalty(
                    score_with_recency,
                    query_normalized,
                    product_text
                )
                if is_fuzzy:
                    final_score = fuzzy_score
                    actual_match_type = "fuzzy"
            
            if final_score >= min_score_threshold:
                suggestion = SearchSuggestion(
                    product=product,
                    relevance_score=final_score,
                    match_type=actual_match_type,
                    matched_fields=["title"],  
                    highlight_positions=[] 
                )
                scored_suggestions.append(suggestion)
        
        phase2_time = (time.time() - phase2_start) * 1000
        self._log_query_performance(query, "scoring", phase2_time)
        
       
        phase3_start = time.time()
        scored_suggestions.sort(key=lambda s: s.relevance_score, reverse=True)
        phase3_time = (time.time() - phase3_start) * 1000
        self._log_query_performance(query, "sorting", phase3_time)
        
        top_suggestions = scored_suggestions[:max_results]
        
        end_time = time.time()
        total_time = (end_time - start_time) * 1000
        
        self._performance_stats['queries_processed'] += 1
        self._performance_stats['avg_response_time_ms'] = (
            (self._performance_stats['avg_response_time_ms'] * 
             (self._performance_stats['queries_processed'] - 1) + total_time) /
            self._performance_stats['queries_processed']
        )
        
        result = SearchSuggestionsResult(
            suggestions=top_suggestions,
            total_candidates=len(candidates),
            products_scanned=len(self.catalog),
            query_time_ms=total_time,
            cache_hit=False
        )
        
        if len(self._query_cache) < 1000:  
            self._query_cache[cache_key] = result
        
        return result
