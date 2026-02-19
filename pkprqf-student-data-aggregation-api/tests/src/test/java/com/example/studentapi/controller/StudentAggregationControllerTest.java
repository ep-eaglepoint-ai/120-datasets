package com.example.studentapi.controller;

import com.example.studentapi.dto.Student;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StudentAggregationControllerTest {

    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    /**
     * Tests correct average calculation with values that don't divide evenly.
     * 85 + 92 + 79 = 256, and 256/3 = 85.333...
     * 
     * FAILS for repository_before: integer division gives 85.0
     * PASSES for repository_after: proper double division gives 85.333...
     */
    @Test
    void aggregateStudents_AverageCalculation_ShouldBeAccurate() throws Exception {
        List<Student> students = Arrays.asList(
            new Student("Alice", 85),
            new Student("Bob", 92),
            new Student("Charlie", 79)
        );
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.averageScore").value(85.33333333333333))
                .andExpect(jsonPath("$.topStudent.name").value("Bob"))
                .andExpect(jsonPath("$.topStudent.score").value(92));
    }
    
    /**
     * Tests that invalid input (empty name, negative score) returns 400 Bad Request.
     * 
     * FAILS for repository_before: returns 200 OK (no validation)
     * PASSES for repository_after: returns 400 with validation errors
     */
    @Test
    void aggregateStudents_WithInvalidInput_ShouldReturnBadRequest() throws Exception {
        List<Student> students = Arrays.asList(
            new Student("", 85),
            new Student("Bob", -10)
        );
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors").isArray());
    }
    
    /**
     * Tests that empty name in input triggers validation error (400 Bad Request).
     * 
     * FAILS for repository_before: returns 200 OK (no validation, accepts empty names)
     * PASSES for repository_after: returns 400 Bad Request (validates and rejects)
     */
    @Test
    void aggregateStudents_WithEmptyName_ShouldReturnBadRequest() throws Exception {
        List<Student> students = Arrays.asList(
            new Student("Alice", 90),
            new Student("", 85),
            new Student("Charlie", 80)
        );
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void aggregateStudents_WithEmptyList_ReturnsEmptyResult() throws Exception {
        List<Student> students = Collections.emptyList();
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.averageScore").value(0.0))
                .andExpect(jsonPath("$.topStudent").isEmpty())
                .andExpect(jsonPath("$.sortedNames").isEmpty());
    }
    
    @Test
    void aggregateStudents_WithNullRequest_ReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("null"))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void aggregateStudents_WithMalformedJson_ReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid json}"))
                .andExpect(status().isBadRequest());
    }
}
