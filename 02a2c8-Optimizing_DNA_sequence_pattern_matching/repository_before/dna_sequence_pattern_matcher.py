def find_dna(genome, pattern):
    """
    Bitap algorithm implementation for DNA sequence matching.
    Time Complexity: O(n) where n = len(genome)
    Preprocessing: O(m + Σ) where m = len(pattern), Σ = alphabet size
    Space: O(Σ) for pattern masks
    
    Yields positions where pattern matches in genome.
    """
    m = len(pattern)
    n = len(genome)
    
    # Edge cases
    if m == 0 or m > n:
        return
    
    # Handle patterns longer than word size (typically 64 bits)
    if m > 63:
        # Fall back to efficient sliding window for very long patterns
        yield from _find_dna_long_pattern(genome, pattern)
        return
    
    # Preprocessing: O(m + Σ)
    # Build pattern mask for each character in alphabet
    pattern_masks = {}
    
    # Initialize all bits to 1 (character not in pattern)
    # We only process characters that appear in the pattern
    for i, char in enumerate(pattern):
        if char not in pattern_masks:
            pattern_masks[char] = (1 << m) - 1  # All bits set to 1
        # Set bit i to 0 where character appears at position i
        pattern_masks[char] &= ~(1 << i)
    
    # Search: O(n)
    # State register: bit i is 0 if pattern[0:i+1] matches
    state = (1 << m) - 1  # All bits set to 1 initially
    match_mask = 1 << (m - 1)  # Bit position indicating full match
    
    for i, char in enumerate(genome):
        # Shift-Or operation
        # 1. Shift state left (prefix matching)
        # 2. OR with pattern mask for current character
        state = (state << 1) | pattern_masks.get(char, (1 << m) - 1)
        
        # Check if pattern matched (bit m-1 is 0)
        if (state & match_mask) == 0:
            yield i - m + 1


def _find_dna_long_pattern(genome, pattern):
    """
    Fallback for patterns longer than 63 characters.
    Uses rolling hash (Rabin-Karp) for efficiency.
    """
    m = len(pattern)
    n = len(genome)
    
    if m > n:
        return
    
    # Simple base for DNA (4 possible values: A, C, G, T)
    BASE = 4
    MOD = 2**31 - 1
    
    # Character to number mapping
    char_map = {'A': 0, 'C': 1, 'G': 2, 'T': 3}
    
    # Calculate hash of pattern and first window
    pattern_hash = 0
    window_hash = 0
    base_power = 1
    
    for i in range(m):
        pattern_hash = (pattern_hash * BASE + char_map.get(pattern[i], 0)) % MOD
        window_hash = (window_hash * BASE + char_map.get(genome[i], 0)) % MOD
        if i < m - 1:
            base_power = (base_power * BASE) % MOD
    
    # Check first window
    if window_hash == pattern_hash and genome[0:m] == pattern:
        yield 0
    
    # Rolling hash for remaining windows
    for i in range(1, n - m + 1):
        # Remove leftmost character and add rightmost character
        window_hash = (window_hash - char_map.get(genome[i-1], 0) * base_power) % MOD
        window_hash = (window_hash * BASE + char_map.get(genome[i+m-1], 0)) % MOD
        window_hash = (window_hash + MOD) % MOD
        
        # Check if hash matches and verify with actual comparison
        if window_hash == pattern_hash and genome[i:i+m] == pattern:
            yield i


# Alternative: Return list instead of generator (if needed)
def find_dna_list(genome, pattern):
    """Returns list of positions instead of generator."""
    return list(find_dna(genome, pattern))


# Example usage and testing
if __name__ == "__main__":
    # Test case
    genome = "ACGTACGTTAGCTAGCTAGCT"
    pattern = "TAGC"
    
    print("Testing Shift-Or algorithm:")
    print(f"Genome: {genome}")
    print(f"Pattern: {pattern}")
    print(f"Positions: {list(find_dna(genome, pattern))}")
    
    # Performance comparison
    import time
    
    # Large test
    large_genome = "ACGT" * 250000  # 1M base pairs
    test_pattern = "ACGTACGT"
    
    start = time.time()
    result = list(find_dna(large_genome, test_pattern))
    end = time.time()
    
    print(f"\nPerformance test:")
    print(f"Genome size: {len(large_genome)} bp")
    print(f"Pattern: {test_pattern}")
    print(f"Matches found: {len(result)}")
    print(f"Time: {(end - start) * 1000:.2f} ms")