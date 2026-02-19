package com.example.studentapi.service;

import com.example.studentapi.dto.AggregationResult;
import com.example.studentapi.dto.Student;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StudentAggregationServicePerformanceTest {
    
    private StudentAggregationService service;
    
    @BeforeEach
    void setUp() {
        service = new StudentAggregationService();
    }
    
    @Test
    void aggregateStudents_WithLargeDataset_CompletesInReasonableTime() {
        List<Student> students = new ArrayList<>();
        
        // Create 10,000 students to test performance
        for (int i = 0; i < 10000; i++) {
            students.add(new Student("Student" + i, i % 100));
        }
        
        long startTime = System.currentTimeMillis();
        AggregationResult result = service.aggregateStudents(students);
        long endTime = System.currentTimeMillis();
        
        // Should complete within 1 second for 10k students
        assertTrue(endTime - startTime < 1000, "Performance test failed - took too long");
        assertEquals(10000, result.getCount());
        assertEquals(49.5, result.getAverageScore(), 0.1);
        assertEquals(99, result.getTopStudent().getScore());
    }
    
    @Test
    void aggregateStudents_WithDuplicateNames_HandlesProperly() {
        List<Student> students = Arrays.asList(
            new Student("Alice", 85),
            new Student("Alice", 90),
            new Student("Bob", 75)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(3, result.getCount());
        assertEquals(83.33, result.getAverageScore(), 0.01);
        assertEquals("Alice", result.getTopStudent().getName());
        assertEquals(90, result.getTopStudent().getScore());
        assertEquals(Arrays.asList("Alice", "Alice", "Bob"), result.getSortedNames());
    }
    
    @Test
    void aggregateStudents_WithZeroScores_HandlesCorrectly() {
        List<Student> students = Arrays.asList(
            new Student("Alice", 0),
            new Student("Bob", 50),
            new Student("Charlie", 0)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(3, result.getCount());
        assertEquals(16.67, result.getAverageScore(), 0.01);
        assertEquals("Bob", result.getTopStudent().getName());
        assertEquals(50, result.getTopStudent().getScore());
    }
    
    @Test
    void aggregateStudents_WithMaxIntegerScore_HandlesCorrectly() {
        List<Student> students = Arrays.asList(
            new Student("Alice", Integer.MAX_VALUE),
            new Student("Bob", 100)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(2, result.getCount());
        assertEquals("Alice", result.getTopStudent().getName());
        assertEquals(Integer.MAX_VALUE, result.getTopStudent().getScore());
    }
    
    @Test
    void aggregateStudents_WithSpecialCharactersInNames_SortsCorrectly() {
        List<Student> students = Arrays.asList(
            new Student("Ñoño", 85),
            new Student("André", 90),
            new Student("Björk", 75),
            new Student("Alice", 80)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(4, result.getCount());
        List<String> sortedNames = result.getSortedNames();
        assertEquals("Alice", sortedNames.get(0));
        assertEquals("André", sortedNames.get(1));
        assertEquals("Björk", sortedNames.get(2));
        assertEquals("Ñoño", sortedNames.get(3));
    }
}
