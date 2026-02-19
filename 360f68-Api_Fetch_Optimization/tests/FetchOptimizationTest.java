import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// Wrapper class for repository_before
class FetchOptimizationBefore {
    public static List<Object> fetchItems(List<Object> items) {
        List<Object> result = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            if (!result.contains(items.get(i))) {
                result.add(items.get(i));
            }
        }
        return result;
    }
}

public class FetchOptimizationTest {
    
    // Test 1: Linear time duplicate removal while preserving insertion order
    @Test
    void test1_LinearTimeDuplicateRemoval_PreservesOrder() {
        List<Object> items = Arrays.asList(1, 2, 3, 2, 4, 1, 5, 3, 6);
        List<Object> expected = Arrays.asList(1, 2, 3, 4, 5, 6);
        
        List<Object> resultAfter = FetchOptimization.fetchItems(items);
        assertEquals(expected, resultAfter);
        
        List<Object> resultBefore = FetchOptimizationBefore.fetchItems(items);
        assertEquals(expected, resultBefore);
    }
    
    // Test 2: Optional pagination with 1-based indexing
    @Test
    void test2_OptionalPagination_OneBasedIndexing() {
        List<Object> items = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
        
        assertEquals(Arrays.asList(1, 2, 3), FetchOptimization.fetchItems(items, 1, 3));
        assertEquals(Arrays.asList(4, 5, 6), FetchOptimization.fetchItems(items, 2, 3));
        assertEquals(Arrays.asList(7, 8, 9), FetchOptimization.fetchItems(items, 3, 3));
        assertEquals(Arrays.asList(10), FetchOptimization.fetchItems(items, 4, 3));
    }
    
    // Test 3: Empty result for out-of-range pages
    @Test
    void test3_OutOfRangePage_ReturnsEmptyList() {
        List<Object> items = Arrays.asList(1, 2, 3);
        
        assertTrue(FetchOptimization.fetchItems(items, 10, 5).isEmpty());
        assertTrue(FetchOptimization.fetchItems(items, 2, 5).isEmpty());
    }
    
    // Test 4: Null input validation
    @Test
    void test4_NullInput_ThrowsException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> FetchOptimization.fetchItems(null));
        assertEquals("Input list cannot be null", ex.getMessage());
        
        assertThrows(Exception.class, () -> FetchOptimizationBefore.fetchItems(null));
    }
    
    // Test 5: Pagination parameters validation
    @Test
    void test5_PaginationValidation() {
        List<Object> items = Arrays.asList(1, 2, 3);
        
        // Both must be provided together
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, null, 5));
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, 1, null));
        
        // Must be positive integers
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, 0, 5));
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, -1, 5));
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, 1, 0));
        assertThrows(IllegalArgumentException.class, () -> FetchOptimization.fetchItems(items, 1, -1));
    }
    
    // Test 6: Backward compatibility
    @Test
    void test6_BackwardCompatibility() {
        List<Object> items = Arrays.asList(1, 2, 3, 2, 4, 1);
        
        List<Object> resultAfter = FetchOptimization.fetchItems(items);
        List<Object> resultBefore = FetchOptimizationBefore.fetchItems(items);
        assertEquals(resultBefore, resultAfter);
        
        // Both null pagination returns all items
        assertEquals(resultAfter, FetchOptimization.fetchItems(items, null, null));
    }
    
    // Test 7: Realistic API-style data handling
    @Test
    void test7_RealisticApiStyle() {
        // Mixed data types
        List<Object> mixed = Arrays.asList("user1", 123, "user2", 456, "user1", 123);
        assertEquals(Arrays.asList("user1", 123, "user2", 456), FetchOptimization.fetchItems(mixed));
        assertEquals(Arrays.asList("user1", 123), FetchOptimization.fetchItems(mixed, 1, 2));
        
        // Large dataset with duplicates
        List<Object> large = new ArrayList<>();
        for (int i = 0; i < 1000; i++) {
            large.add(i % 100);
        }
        assertEquals(100, FetchOptimization.fetchItems(large).size());
        assertEquals(10, FetchOptimization.fetchItems(large, 1, 10).size());
        
        // Pagination with duplicates in input
        List<Object> withDupes = Arrays.asList(1, 2, 1, 3, 2, 4, 1, 5);
        assertEquals(Arrays.asList(1, 2), FetchOptimization.fetchItems(withDupes, 1, 2));
    }
}
