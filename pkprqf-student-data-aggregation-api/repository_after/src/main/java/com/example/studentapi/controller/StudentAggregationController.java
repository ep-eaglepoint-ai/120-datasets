package com.example.studentapi.controller;

import com.example.studentapi.dto.AggregationResult;
import com.example.studentapi.dto.Student;
import com.example.studentapi.service.StudentAggregationService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/students")
public class StudentAggregationController {

    private final StudentAggregationService aggregationService;
    private final Validator validator;

    public StudentAggregationController(StudentAggregationService aggregationService, Validator validator) {
        this.aggregationService = aggregationService;
        this.validator = validator;
    }

    @PostMapping("/aggregate")
    public ResponseEntity<?> aggregateStudents(@RequestBody List<Student> students) {
        if (students == null) {
            Map<String, Object> errorResponse = Map.of("error", "Students list cannot be null");
            return ResponseEntity.badRequest().body(errorResponse);
        }

        List<String> validationErrors = validateStudents(students);
        if (!validationErrors.isEmpty()) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("error", "Validation failed");
            errorResponse.put("validationErrors", validationErrors);
            return ResponseEntity.badRequest().body(errorResponse);
        }

        try {
            AggregationResult result = aggregationService.aggregateStudents(students);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> errorResponse = Map.of("error", "Internal server error occurred");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    private List<String> validateStudents(List<Student> students) {
        List<String> errors = new ArrayList<>();
        for (int i = 0; i < students.size(); i++) {
            Student student = students.get(i);
            if (student == null) {
                errors.add("students[" + i + "]: Student cannot be null");
                continue;
            }
            Set<ConstraintViolation<Student>> violations = validator.validate(student);
            for (ConstraintViolation<Student> v : violations) {
                errors.add("students[" + i + "]." + v.getPropertyPath() + ": " + v.getMessage());
            }
        }
        return errors;
    }
}