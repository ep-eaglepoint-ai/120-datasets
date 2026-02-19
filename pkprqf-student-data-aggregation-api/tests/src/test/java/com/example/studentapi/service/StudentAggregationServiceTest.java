package com.example.studentapi.service;

import com.example.studentapi.dto.AggregationResult;
import com.example.studentapi.dto.Student;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StudentAggregationServiceTest {
    
    private StudentAggregationService service;
    
    @BeforeEach
    void setUp() {
        service = new StudentAggregationService();
    }
    
    @Test
    void aggregateStudents_WithValidStudents_ReturnsCorrectAggregation() {
        List<Student> students = Arrays.asList(
            new Student("Alice", 85),
            new Student("Bob", 92),
            new Student("Charlie", 78)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(3, result.getCount());
        assertEquals(85.0, result.getAverageScore(), 0.01);
        assertEquals("Bob", result.getTopStudent().getName());
        assertEquals(92, result.getTopStudent().getScore());
        assertEquals(Arrays.asList("Alice", "Bob", "Charlie"), result.getSortedNames());
    }
    
    @Test
    void aggregateStudents_WithNegativeScores_FiltersOutNegativeScores() {
        List<Student> students = Arrays.asList(
            new Student("Alice", 85),
            new Student("Bob", -10),
            new Student("Charlie", 78)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(2, result.getCount());
        assertEquals(81.5, result.getAverageScore(), 0.01);
        assertEquals("Alice", result.getTopStudent().getName());
        assertEquals(Arrays.asList("Alice", "Bob", "Charlie"), result.getSortedNames());
    }
    
    @Test
    void aggregateStudents_WithEmptyList_ReturnsEmptyResult() {
        List<Student> students = Collections.emptyList();
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(0, result.getCount());
        assertEquals(0.0, result.getAverageScore());
        assertNull(result.getTopStudent());
        assertTrue(result.getSortedNames().isEmpty());
    }
    
    @Test
    void aggregateStudents_WithNullList_ReturnsEmptyResult() {
        AggregationResult result = service.aggregateStudents(null);
        
        assertEquals(0, result.getCount());
        assertEquals(0.0, result.getAverageScore());
        assertNull(result.getTopStudent());
        assertTrue(result.getSortedNames().isEmpty());
    }
    
    @Test
    void aggregateStudents_WithAllNegativeScores_ReturnsZeroAverageAndNullTopStudent() {
        List<Student> students = Arrays.asList(
            new Student("Alice", -10),
            new Student("Bob", -20)
        );
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(0, result.getCount());
        assertEquals(0.0, result.getAverageScore());
        assertNull(result.getTopStudent());
        assertEquals(Arrays.asList("Alice", "Bob"), result.getSortedNames());
    }
    
    @Test
    void aggregateStudents_WithSingleStudent_ReturnsCorrectResult() {
        List<Student> students = Collections.singletonList(new Student("Alice", 85));
        
        AggregationResult result = service.aggregateStudents(students);
        
        assertEquals(1, result.getCount());
        assertEquals(85.0, result.getAverageScore());
        assertEquals("Alice", result.getTopStudent().getName());
        assertEquals(Collections.singletonList("Alice"), result.getSortedNames());
    }
}
