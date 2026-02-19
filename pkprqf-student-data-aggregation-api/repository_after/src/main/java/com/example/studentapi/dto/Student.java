package com.example.studentapi.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class Student {
    
    @NotBlank(message = "Student name cannot be blank")
    private String name;
    
    @NotNull(message = "Student score cannot be null")
    @Min(value = 0, message = "Student score must be non-negative")
    private Integer score;
    
    public Student() {}
    
    public Student(String name, Integer score) {
        this.name = name;
        this.score = score;
    }
    
    public String getName() {
        return name;
    }
    
    public void setName(String name) {
        this.name = name;
    }
    
    public Integer getScore() {
        return score;
    }
    
    public void setScore(Integer score) {
        this.score = score;
    }
}