package com.example.studentapi.service;

import com.example.studentapi.dto.AggregationResult;
import com.example.studentapi.dto.Student;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class StudentAggregationServiceThreadSafetyTest {
    
    private StudentAggregationService service;
    
    @BeforeEach
    void setUp() {
        service = new StudentAggregationService();
    }
    
    @Test
    void aggregateStudents_ConcurrentExecution_ProducesConsistentResults() throws Exception {
        List<Student> students1 = Arrays.asList(
            new Student("Alice", 85),
            new Student("Bob", 92),
            new Student("Charlie", 78)
        );
        
        List<Student> students2 = Arrays.asList(
            new Student("David", 95),
            new Student("Eve", 88)
        );
        
        ExecutorService executor = Executors.newFixedThreadPool(10);
        
        // Execute multiple concurrent requests
        CompletableFuture<AggregationResult>[] futures = IntStream.range(0, 100)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
                    if (i % 2 == 0) {
                        return service.aggregateStudents(students1);
                    } else {
                        return service.aggregateStudents(students2);
                    }
                }, executor))
                .toArray(CompletableFuture[]::new);
        
        CompletableFuture.allOf(futures).join();
        
        // Verify all results are consistent
        for (int i = 0; i < futures.length; i++) {
            AggregationResult result = futures[i].get();
            
            if (i % 2 == 0) {
                // Results for students1
                assertEquals(3, result.getCount());
                assertEquals(85.0, result.getAverageScore(), 0.01);
                assertEquals("Bob", result.getTopStudent().getName());
            } else {
                // Results for students2
                assertEquals(2, result.getCount());
                assertEquals(91.5, result.getAverageScore(), 0.01);
                assertEquals("David", result.getTopStudent().getName());
            }
        }
        
        executor.shutdown();
    }
    
    @Test
    void aggregateStudents_NoSharedState_IndependentResults() {
        List<Student> students1 = Arrays.asList(new Student("Alice", 85));
        List<Student> students2 = Arrays.asList(new Student("Bob", 92));
        
        // Execute sequentially to ensure no state leakage
        AggregationResult result1 = service.aggregateStudents(students1);
        AggregationResult result2 = service.aggregateStudents(students2);
        
        // Verify results are independent
        assertEquals("Alice", result1.getTopStudent().getName());
        assertEquals(85, result1.getTopStudent().getScore());
        
        assertEquals("Bob", result2.getTopStudent().getName());
        assertEquals(92, result2.getTopStudent().getScore());
        
        // Verify first result wasn't affected by second call
        assertEquals("Alice", result1.getTopStudent().getName());
        assertEquals(85, result1.getTopStudent().getScore());
    }
}
