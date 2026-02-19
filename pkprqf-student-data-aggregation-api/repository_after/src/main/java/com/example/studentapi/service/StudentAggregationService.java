package com.example.studentapi.service;

import com.example.studentapi.dto.AggregationResult;
import com.example.studentapi.dto.Student;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class StudentAggregationService {
    
    public AggregationResult aggregateStudents(List<Student> students) {
        if (students == null || students.isEmpty()) {
            return new AggregationResult(0, 0.0, null, List.of());
        }
        
        List<Student> validStudents = filterValidStudents(students);
        
        int count = validStudents.size();
        double averageScore = calculateAverageScore(validStudents);
        Student topStudent = findTopStudent(validStudents);
        List<String> sortedNames = extractSortedNames(students);
        
        return new AggregationResult(count, averageScore, topStudent, sortedNames);
    }
    
    private List<Student> filterValidStudents(List<Student> students) {
        return students.stream()
                .filter(student -> student.getScore() != null && student.getScore() >= 0)
                .collect(Collectors.toList());
    }
    
    private double calculateAverageScore(List<Student> validStudents) {
        if (validStudents.isEmpty()) {
            return 0.0;
        }
        
        int totalScore = validStudents.stream()
                .mapToInt(Student::getScore)
                .sum();
        
        return (double) totalScore / validStudents.size();
    }
    
    private Student findTopStudent(List<Student> validStudents) {
        return validStudents.stream()
                .max((s1, s2) -> Integer.compare(s1.getScore(), s2.getScore()))
                .orElse(null);
    }
    
    private List<String> extractSortedNames(List<Student> students) {
        return students.stream()
                .map(Student::getName)
                .filter(name -> name != null && !name.trim().isEmpty())
                .sorted()
                .collect(Collectors.toList());
    }
}