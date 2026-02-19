package com.example.studentapi.controller;

import com.example.studentapi.dto.Student;
import com.example.studentapi.service.StudentAggregationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StudentAggregationControllerErrorHandlingTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private StudentAggregationService aggregationService;

    @Test
    void aggregateStudents_WhenServiceThrows_ReturnsInternalServerError() throws Exception {
        when(aggregationService.aggregateStudents(anyList())).thenThrow(new RuntimeException("Service failure"));

        List<Student> students = Arrays.asList(
                new Student("Alice", 85),
                new Student("Bob", 92)
        );

        mockMvc.perform(post("/api/students/aggregate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(students)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Internal server error occurred"));
    }
}
