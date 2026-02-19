package com.example.studentapi.structure;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Structure-only checks for repository_before/dataAggregation.java.
 * These tests inspect source code against the 12 requirements; they do not run the application.
 * For repository_before (bad code) these tests fail. Exit code is forced to 0 by the test-before command.
 */
@DisplayName("Repository Before - Code Structure (requirements)")
class RepositoryBeforeStructureTest {

    private static String code;

    @BeforeAll
    static void loadSource() throws Exception {
        String pathProp = System.getProperty("structure.repo.before.path");
        Path path = pathProp != null && !pathProp.isEmpty()
                ? Paths.get(pathProp)
                : Paths.get("repository_before/dataAggregation.java");
        if (!Files.exists(path)) {
            path = Paths.get("../repository_before/dataAggregation.java");
        }
        assertTrue(Files.exists(path), "repository_before/dataAggregation.java not found at: " + path);
        code = Files.readString(path);
    }

    @Test
    @DisplayName("1. No shared mutable state (stateless, thread-safe)")
    void noSharedMutableState() {
        assertFalse(code.contains("cachedStudents"),
                "Controller must not have shared mutable state (e.g. cachedStudents) - requirement 2, 3");
    }

    @Test
    @DisplayName("2. Input validation present")
    void hasInputValidation() {
        assertTrue(code.contains("@Valid") || code.contains("@NotBlank") || code.contains("@NotNull") || code.contains("@Min"),
                "Must add proper input validation (@Valid or validation annotations) - requirement 6");
    }

    @Test
    @DisplayName("3. No unnecessary nested loops (efficient aggregation)")
    void noUnnecessaryNestedLoops() {
        int forCount = 0;
        int depth = 0;
        for (int i = 0; i < code.length() - 4; i++) {
            if (code.regionMatches(i, "for (", 0, 5)) {
                forCount++;
                depth++;
            } else if (code.charAt(i) == '}' && depth > 0) {
                depth--;
            }
        }
        assertTrue(forCount <= 1,
                "Must eliminate unnecessary nested loops (O(n^2) -> O(n)) - requirement 4, 5");
    }

    @Test
    @DisplayName("4. Separation of concerns (controller delegates to service)")
    void hasSeparationOfConcerns() {
        boolean hasService = code.contains("Service") && (code.contains("aggregationService") || code.contains("aggregateStudents"));
        boolean noInlineAggregation = !code.contains("totalScore = totalScore +") && !code.contains("totalScore += ");
        assertTrue(hasService || noInlineAggregation,
                "Must maintain clear separation of concerns (controller delegates to service) - requirement 11");
    }

    @Test
    @DisplayName("5. Proper error handling and HTTP status codes")
    void hasProperErrorHandling() {
        boolean hasResponseEntity = code.contains("ResponseEntity");
        boolean hasStatusCodes = code.contains("badRequest") || code.contains("BAD_REQUEST") || code.contains("BindingResult");
        assertTrue(hasResponseEntity && hasStatusCodes,
                "Must use ResponseEntity and appropriate HTTP status codes - requirement 7, 8");
    }

    @Test
    @DisplayName("6. No instance mutable fields (stateless)")
    void noInstanceMutableFields() {
        assertFalse(code.contains("private List<") || code.contains("private ArrayList<") || code.contains("cachedStudents"),
                "Controller must be stateless; remove instance mutable state - requirement 2, 3");
    }

    @Test
    @DisplayName("7. Spring Boot best practices (service layer)")
    void usesServiceLayer() {
        assertTrue(code.contains("Service") && code.contains("aggregateStudents"),
                "Refactor to use @Service and delegate aggregation - requirement 1");
    }

    @Test
    @DisplayName("8. Efficient single-pass aggregation")
    void usesEfficientAggregation() {
        // Nested for over same list indicates O(n^2) - requirement 5
        int firstFor = code.indexOf("for (");
        int secondFor = firstFor == -1 ? -1 : code.indexOf("for (", firstFor + 5);
        assertTrue(secondFor == -1,
                "Use efficient single-pass aggregation; avoid nested loops over same list - requirement 5");
    }
}
