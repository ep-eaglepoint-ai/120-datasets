package com.example.studentapi.dto;

import java.util.List;

public class AggregationResult {
    
    private int count;
    private double averageScore;
    private Student topStudent;
    private List<String> sortedNames;
    
    public AggregationResult(int count, double averageScore, Student topStudent, List<String> sortedNames) {
        this.count = count;
        this.averageScore = averageScore;
        this.topStudent = topStudent;
        this.sortedNames = sortedNames;
    }
    
    public int getCount() {
        return count;
    }
    
    public double getAverageScore() {
        return averageScore;
    }
    
    public Student getTopStudent() {
        return topStudent;
    }
    
    public List<String> getSortedNames() {
        return sortedNames;
    }
}