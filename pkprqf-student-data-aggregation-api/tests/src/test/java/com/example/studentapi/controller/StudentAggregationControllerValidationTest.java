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
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StudentAggregationControllerValidationTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @Test
    void aggregateStudents_WithBlankName_ReturnsValidationError() throws Exception {
        List<Student> students = Arrays.asList(
            new Student("", 85),
            new Student("Bob", 92)
        );
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors").isArray());
    }
    
    @Test
    void aggregateStudents_WithNullName_ReturnsValidationError() throws Exception {
        String jsonContent = "[{\"name\": null, \"score\": 85}, {\"name\": \"Bob\", \"score\": 92}]";
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonContent))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation failed"));
    }
    
    @Test
    void aggregateStudents_WithNegativeScore_ReturnsValidationError() throws Exception {
        List<Student> students = Arrays.asList(
            new Student("Alice", -10),
            new Student("Bob", 92)
        );
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation failed"))
                .andExpect(jsonPath("$.validationErrors").isArray());
    }
    
    @Test
    void aggregateStudents_WithNullScore_ReturnsValidationError() throws Exception {
        String jsonContent = "[{\"name\": \"Alice\", \"score\": null}, {\"name\": \"Bob\", \"score\": 92}]";
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonContent))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation failed"));
    }
    
    @Test
    void aggregateStudents_WithMissingFields_ReturnsValidationError() throws Exception {
        String jsonContent = "[{\"name\": \"Alice\"}, {\"score\": 92}]";
        
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(jsonContent))
                .andExpect(status().isBadRequest());
    }
    
    @Test
    void aggregateStudents_WithInvalidHttpMethod_ReturnsMethodNotAllowed() throws Exception {
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/students/aggregate"))
                .andExpect(status().isMethodNotAllowed());
    }
    
    @Test
    void aggregateStudents_WithInvalidContentType_ReturnsUnsupportedMediaType() throws Exception {
        // Spring returns 415 Unsupported Media Type for non-JSON content types
        mockMvc.perform(post("/api/students/aggregate")
                .contentType(MediaType.TEXT_PLAIN)
                .content("invalid content"))
                .andExpect(status().isUnsupportedMediaType());
    }
}
