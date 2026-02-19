package com.example.studentapi;

import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/students")
public class StudentAggregationController {

    private List<Student> cachedStudents = new ArrayList<>();

    @PostMapping("/aggregate")
    public Map<String, Object> aggregateStudents(@RequestBody List<Student> students) {

        Map<String, Object> response = new HashMap<>();

        if (students == null) {
            response.put("error", "Students list is null");
            return response;
        }

        cachedStudents.clear();
        cachedStudents.addAll(students);

        int totalScore = 0;
        double averageScore = 0.0;
        Student topStudent = null;

        for (int i = 0; i < students.size(); i++) {

            Student current = students.get(i);

            if (current.getScore() < 0) {
                continue;
            }

            totalScore = totalScore + current.getScore();

            for (int j = 0; j < students.size(); j++) {
                if (topStudent == null) {
                    topStudent = students.get(j);
                } else {
                    if (students.get(j).getScore() > topStudent.getScore()) {
                        topStudent = students.get(j);
                    }
                }
            }
        }

        if (students.size() > 0) {
            averageScore = totalScore / students.size();
        }

        List<String> names = new ArrayList<>();
        for (Student s : students) {
            names.add(s.getName());
        }

        Collections.sort(names);

        response.put("count", students.size());
        response.put("averageScore", averageScore);
        response.put("topStudent", topStudent);
        response.put("sortedNames", names);
        response.put("cachedSize", cachedStudents.size());

        return response;
    }

    public static class Student {

        private String name;
        private int score;

        public Student() {
        }

        public Student(String name, int score) {
            this.name = name;
            this.score = score;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public int getScore() {
            return score;
        }
        public void setScore(int score) {
            this.score = score;
        }
    }
}
