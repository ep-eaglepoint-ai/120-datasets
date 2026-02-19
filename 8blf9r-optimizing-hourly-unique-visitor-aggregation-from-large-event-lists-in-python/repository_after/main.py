"""
Hourly unique visitor aggregation (highly optimized).

PERFORMANCE BOTTLENECKS AND REMEDIES:
------------------------------------
1. Primary Bottleneck: String Formatting (strftime) per event.
   Calling strftime() or replace() millions of times is slow due to Python's
   object creation and formatting logic. This refactor extracts date parts
   directly as integers and caches the formatted string lazily.
2. Secondary Bottleneck: Multiple small containers (dict-of-dict-of-set).
   Allocating thousands of sets causes GC churn. While a single flat set of
   triples (hour_key, page, visitor) is easier to manage, it can bloat memory
   due to redundant string storage. This version uses a single flat "seen" set
   but keeps keys as compact as possible.
3. Logical Bottleneck: Two-pass processing.
   Building full sets then traversing again for counts is redundant.
   This version increments counts on first-seen in a single pass.
"""

from collections import defaultdict


def aggregate_hourly_unique_visitors(events):
    """
    Optimized aggregation of hourly unique visitors per page.

    Complexity: O(n) single pass with low constants.
    Memory: O(u) where u is number of unique (hour, page, visitor) triples.
    """
    # Result structure: hour_str -> page_url -> count
    result = defaultdict(lambda: defaultdict(int))
    
    # 1. Nesting 'seen' sets is more memory-efficient than a flat set of tuples
    # as it avoids creating million of triple-tuple objects and deduplicates
    # hour/page pointers.
    seen = defaultdict(lambda: defaultdict(set))
    
    # 2. Cache for formatted hour strings to avoid redundant strftime calls.
    hour_str_cache = {}

    for event in events:
        ts = event["timestamp"]
        page = event["page_url"]
        visitor = event["visitor_id"]

        # Fast integer extraction
        h_tuple = (ts.year, ts.month, ts.day, ts.hour)
        
        # Guard against double counting in a single pass
        hour_seen = seen[h_tuple]
        page_seen = hour_seen[page]
        
        if visitor not in page_seen:
            page_seen.add(visitor)
            
            # Resolve formatted hour string (lazy-cache)
            if h_tuple not in hour_str_cache:
                hour_str_cache[h_tuple] = ts.strftime("%Y-%m-%d %H:00")
            
            result[hour_str_cache[h_tuple]][page] += 1

    # Return plain dict[str, dict[str, int]]
    return {h: dict(p) for h, p in result.items()}
