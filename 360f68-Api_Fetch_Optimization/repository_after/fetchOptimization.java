import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

class FetchOptimization {
    
    // Problem 1: Optimize performance (O(n²) -> O(n))
    // Problem 4: Backward compatibility (same behavior as original)
    public static List<Object> fetchItems(List<Object> items) {
        // Problem 3: Input validation
        if (items == null) {
            throw new IllegalArgumentException("Input list cannot be null");
        }
        // Problem 1: O(n) duplicate removal with LinkedHashSet, preserves order
        return new ArrayList<>(new LinkedHashSet<>(items));
    }
    
    // Problem 2: Add pagination support
    public static List<Object> fetchItems(List<Object> items, Integer page, Integer pageSize) {
        // Problem 3: Input validation - null check
        if (items == null) {
            throw new IllegalArgumentException("Input list cannot be null");
        }
        
        // Problem 2: Pagination optional - if both null, return all unique items
        if (page == null && pageSize == null) {
            return fetchItems(items);
        }
        
        // Problem 3: Input validation - both pagination params required together
        if (page == null || pageSize == null) {
            throw new IllegalArgumentException("Both page and pageSize must be provided together");
        }
        
        // Problem 3: Input validation - positive integers
        if (page <= 0 || pageSize <= 0) {
            throw new IllegalArgumentException("Page and pageSize must be positive");
        }
        
        // Problem 1: O(n) duplicate removal, preserves order
        List<Object> uniqueList = new ArrayList<>(new LinkedHashSet<>(items));
        // Problem 2: 1-based page indexing
        int startIndex = (page - 1) * pageSize;
        
        // Problem 2: Handle out-of-range pages gracefully
        if (startIndex >= uniqueList.size()) {
            return new ArrayList<>();
        }
        
        // Problem 2: Pagination bounds calculation
        int endIndex = Math.min(startIndex + pageSize, uniqueList.size());
        return new ArrayList<>(uniqueList.subList(startIndex, endIndex));
    }
}
