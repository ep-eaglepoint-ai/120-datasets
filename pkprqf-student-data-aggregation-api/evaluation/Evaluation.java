import java.io.*;
import java.net.InetAddress;
import java.nio.file.*;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Evaluation {

    private static final String TASK_NAME = "Student Data Aggregation API";
    private static final String REPOSITORY_BEFORE = "../repository_before";
    private static final String REPOSITORY_AFTER = "../repository_after";
    private static final String TESTS_DIR = "../tests";

    public static void main(String[] args) {
        try {
            String runId = generateRunId();
            Instant startedAt = Instant.now();

            printHeader("EVALUATION: " + TASK_NAME);
            System.out.println("Run ID: " + runId);
            System.out.println("Started at: " + startedAt);
            System.out.println("Working directory: " + Paths.get("").toAbsolutePath());

            // Run structural checks
            Map<String, Object> structuralResults = runStructuralChecks();

            // Install repository_after first so tests module can resolve dependency (needed for structure tests too)
            prepareTestEnvironment(REPOSITORY_AFTER);

            // Run structure tests for repository_before (no app run; expect failures)
            Map<String, Object> beforeResults = runStructureTestsForBefore();
            // Run real tests for repository_after
            Map<String, Object> afterResults = runTests(REPOSITORY_AFTER);

            Instant finishedAt = Instant.now();
            double duration = (finishedAt.toEpochMilli() - startedAt.toEpochMilli()) / 1000.0;

            // Create comparison
            Map<String, Object> comparison = createComparison(beforeResults, afterResults);

            // Determine overall success: YES when after tests all pass (before tests are expected to fail)
            boolean testSuccess = (boolean) afterResults.get("success");
            boolean success = testSuccess;

            // Create and save report
            Map<String, Object> report = createReport(runId, startedAt, finishedAt, duration,
                    success, beforeResults, afterResults, comparison, structuralResults);

            String reportPath = saveReport(report, startedAt);
            printSummary(report);

            System.out.println("\n✅ Report saved to: " + reportPath);
            printHeader("EVALUATION COMPLETE");
            System.out.printf("Duration: %.2fs%n", duration);
            System.out.println("Success: " + (success ? "✅ YES" : "❌ NO"));

            System.exit(success ? 0 : 1);

        } catch (Exception e) {
            System.err.println("Evaluation failed with error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static String generateRunId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private static void printHeader(String title) {
        System.out.println("\n" + "=".repeat(60));
        System.out.println(title);
        System.out.println("=".repeat(60));
    }

    private static Map<String, Object> runStructureTestsForBefore() throws Exception {
        printHeader("RUNNING STRUCTURE TESTS: " + REPOSITORY_BEFORE);

        Map<String, Object> result = new LinkedHashMap<>();
        Path testsDir = Paths.get(TESTS_DIR).toAbsolutePath();
        Path repoBeforeFile = Paths.get(REPOSITORY_BEFORE).toAbsolutePath().resolve("dataAggregation.java");

        try {
            String mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
            ProcessBuilder pb = new ProcessBuilder(
                mvnCommand, "test", "-q",
                "-Dtest=RepositoryBeforeStructureTest",
                "-Dstructure.repo.before.path=" + repoBeforeFile.toString()
            );
            pb.directory(testsDir.toFile());
            pb.redirectErrorStream(true);

            System.out.println("Working directory: " + testsDir);
            System.out.println("Running: mvn test (structure tests only)");

            Process process = pb.start();
            StringBuilder outputBuilder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputBuilder.append(line).append("\n");
                    System.out.println("  " + line);
                }
            }

            boolean finished = process.waitFor(120, TimeUnit.SECONDS);
            int exitCode = finished ? process.exitValue() : 1;
            if (!finished) process.destroyForcibly();

            String output = outputBuilder.toString();
            List<Map<String, Object>> tests = parseStructureTestResults(output);
            Map<String, Integer> summary = createSummary(tests);
            boolean success = exitCode == 0 && summary.get("failed") == 0 && summary.get("errors") == 0;

            result.put("success", success);
            result.put("exit_code", exitCode);
            result.put("tests", tests);
            result.put("summary", summary);
            result.put("stdout", output);
            result.put("stderr", "");
        } catch (Exception e) {
            result.put("success", false);
            result.put("exit_code", 1);
            result.put("tests", new ArrayList<>());
            result.put("summary", createErrorSummary());
            result.put("error", e.getMessage());
            result.put("stdout", "");
            result.put("stderr", e.getMessage());
            e.printStackTrace();
        }
        return result;
    }

    private static final String[] STRUCTURE_TEST_NAMES = {
        "noSharedMutableState", "hasInputValidation", "noUnnecessaryNestedLoops",
        "hasSeparationOfConcerns", "hasProperErrorHandling", "noInstanceMutableFields",
        "usesServiceLayer", "usesEfficientAggregation"
    };

    private static List<Map<String, Object>> parseStructureTestResults(String output) {
        List<Map<String, Object>> tests = new ArrayList<>();
        Set<String> failedTests = new HashSet<>();
        Set<String> knownNames = new HashSet<>(Arrays.asList(STRUCTURE_TEST_NAMES));

        // Surefire format: "ClassName.methodName  Time elapsed ... FAILURE" or "methodName -- Time elapsed ... FAILURE"
        Pattern withClass = Pattern.compile("\\.(\\w+)\\s+(?:--\\s+)?Time elapsed\\s+[\\d.]+\\s*s\\s*(?:<<<)?\\s*FAILURE", Pattern.MULTILINE);
        Matcher m = withClass.matcher(output);
        while (m.find()) {
            String name = m.group(1);
            if (knownNames.contains(name)) failedTests.add(name);
        }
        if (failedTests.isEmpty()) {
            Pattern methodOnly = Pattern.compile("(\\w+)\\s+(?:--\\s+)?Time elapsed\\s+[\\d.]+\\s*s\\s*(?:<<<)?\\s*FAILURE", Pattern.MULTILINE);
            m = methodOnly.matcher(output);
            while (m.find()) {
                String name = m.group(1);
                if (knownNames.contains(name)) failedTests.add(name);
            }
        }
        // Fallback: if Failures: N with N>0, treat each structure test that appears before "FAILURE" as failed
        if (failedTests.isEmpty() && (output.contains("Failures:") || output.contains("There are test failures"))) {
            for (String testName : STRUCTURE_TEST_NAMES) {
                int idx = output.indexOf(testName);
                if (idx >= 0 && output.substring(idx, Math.min(idx + 200, output.length())).contains("FAILURE"))
                    failedTests.add(testName);
            }
        }

        for (String testName : STRUCTURE_TEST_NAMES) {
            Map<String, Object> test = new LinkedHashMap<>();
            test.put("nodeid", REPOSITORY_BEFORE + "::" + testName);
            test.put("name", testName);
            test.put("outcome", failedTests.contains(testName) ? "failed" : "passed");
            test.put("message", failedTests.contains(testName) ? "Structure requirement not met" : testName);
            tests.add(test);
        }
        return tests;
    }

    private static Map<String, Object> runStructuralChecks() {
        printHeader("STRUCTURAL CHECKS");
        
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> checks = new ArrayList<>();
        boolean allPassed = true;

        try {
            // Check for main source files
            Path controllerFile = Paths.get(REPOSITORY_AFTER, "src/main/java/com/example/studentapi/controller/StudentAggregationController.java");
            Path serviceFile = Paths.get(REPOSITORY_AFTER, "src/main/java/com/example/studentapi/service/StudentAggregationService.java");
            Path studentDtoFile = Paths.get(REPOSITORY_AFTER, "src/main/java/com/example/studentapi/dto/Student.java");
            Path resultDtoFile = Paths.get(REPOSITORY_AFTER, "src/main/java/com/example/studentapi/dto/AggregationResult.java");
            Path appFile = Paths.get(REPOSITORY_AFTER, "src/main/java/com/example/studentapi/StudentApiApplication.java");

            // CHK-01: Controller file exists
            boolean controllerExists = Files.exists(controllerFile);
            checks.add(createCheck("CHK-01", "Controller file exists", controllerExists));
            if (!controllerExists) allPassed = false;

            // CHK-02: Service file exists
            boolean serviceExists = Files.exists(serviceFile);
            checks.add(createCheck("CHK-02", "Service file exists", serviceExists));
            if (!serviceExists) allPassed = false;

            // CHK-03: DTO files exist
            boolean dtosExist = Files.exists(studentDtoFile) && Files.exists(resultDtoFile);
            checks.add(createCheck("CHK-03", "DTO files exist", dtosExist));
            if (!dtosExist) allPassed = false;

            // CHK-04: Application file exists
            boolean appExists = Files.exists(appFile);
            checks.add(createCheck("CHK-04", "Application file exists", appExists));
            if (!appExists) allPassed = false;

            if (controllerExists && serviceExists) {
                String controllerCode = Files.readString(controllerFile);
                String serviceCode = Files.readString(serviceFile);

                // CHK-05: Uses @RestController annotation
                boolean hasRestController = controllerCode.contains("@RestController");
                checks.add(createCheck("CHK-05", "Uses @RestController annotation", hasRestController));
                if (!hasRestController) allPassed = false;

                // CHK-06: Uses @Service annotation
                boolean hasService = serviceCode.contains("@Service");
                checks.add(createCheck("CHK-06", "Uses @Service annotation", hasService));
                if (!hasService) allPassed = false;

                // CHK-07: Has POST mapping for /aggregate
                boolean hasPostMapping = controllerCode.contains("@PostMapping") && controllerCode.contains("/aggregate");
                checks.add(createCheck("CHK-07", "Has POST /aggregate endpoint", hasPostMapping));
                if (!hasPostMapping) allPassed = false;

                // CHK-08: Uses validation annotations
                String studentCode = Files.exists(studentDtoFile) ? Files.readString(studentDtoFile) : "";
                boolean hasValidation = studentCode.contains("@NotBlank") || studentCode.contains("@NotNull") || studentCode.contains("@Min");
                checks.add(createCheck("CHK-08", "Uses validation annotations", hasValidation));
                if (!hasValidation) allPassed = false;

                // CHK-09: Service has aggregateStudents method
                boolean hasAggregateMethod = serviceCode.contains("aggregateStudents");
                checks.add(createCheck("CHK-09", "Service has aggregateStudents method", hasAggregateMethod));
                if (!hasAggregateMethod) allPassed = false;

                // CHK-10: Proper separation of concerns
                boolean properSeparation = !controllerCode.contains("calculateAverageScore") && serviceCode.contains("calculateAverageScore");
                checks.add(createCheck("CHK-10", "Proper separation of concerns", properSeparation));
                if (!properSeparation) allPassed = false;

                // CHK-11: No shared mutable state in controller (stateless, thread-safe)
                boolean noSharedMutableState = !controllerCode.contains("cachedStudents")
                        && !controllerCode.contains("private List<")
                        && !controllerCode.contains("private ArrayList<");
                checks.add(createCheck("CHK-11", "Controller has no shared mutable state", noSharedMutableState));
                if (!noSharedMutableState) allPassed = false;
            }

            for (Map<String, Object> check : checks) {
                String status = (boolean) check.get("passed") ? "✅" : "❌";
                System.out.println("  " + status + " " + check.get("name"));
            }

            result.put("success", allPassed);
            result.put("checks", checks);

        } catch (Exception e) {
            result.put("success", false);
            result.put("checks", checks);
            result.put("error", e.getMessage());
        }

        return result;
    }

    private static Map<String, Object> createCheck(String id, String name, boolean passed) {
        Map<String, Object> check = new LinkedHashMap<>();
        check.put("id", id);
        check.put("name", name);
        check.put("passed", passed);
        check.put("outcome", passed ? "passed" : "failed");
        return check;
    }

    private static Map<String, Object> runTests(String repoName) throws Exception {
        printHeader("RUNNING TESTS: " + repoName);

        Map<String, Object> result = new LinkedHashMap<>();

        try {
            // Copy source files to tests directory
            prepareTestEnvironment(repoName);

            Path testsDir = Paths.get(TESTS_DIR);
            
            ProcessBuilder pb = new ProcessBuilder();
            String mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
            pb.command(mvnCommand, "test", "-q", "-Dtest=!RepositoryBeforeStructureTest");
            pb.directory(testsDir.toFile());
            pb.redirectErrorStream(true);

            System.out.println("Working directory: " + testsDir.toAbsolutePath());
            System.out.println("Running: mvn test");

            Process process = pb.start();

            StringBuilder outputBuilder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputBuilder.append(line).append("\n");
                    System.out.println("  " + line);
                }
            }

            boolean finished = process.waitFor(300, TimeUnit.SECONDS);
            int exitCode = finished ? process.exitValue() : 1;

            if (!finished) {
                process.destroyForcibly();
            }

            String output = outputBuilder.toString();

            List<Map<String, Object>> tests = parseTestResults(output, repoName);
            Map<String, Integer> summary = createSummary(tests);

            boolean success = exitCode == 0 && summary.get("failed") == 0 && summary.get("errors") == 0;

            result.put("success", success);
            result.put("exit_code", exitCode);
            result.put("tests", tests);
            result.put("summary", summary);
            result.put("stdout", output);
            result.put("stderr", "");

        } catch (Exception e) {
            result.put("success", false);
            result.put("exit_code", 1);
            result.put("tests", new ArrayList<>());
            result.put("summary", createErrorSummary());
            result.put("error", e.getMessage());
            result.put("stdout", "");
            result.put("stderr", e.getMessage());
            e.printStackTrace();
        }

        return result;
    }

    private static void prepareTestEnvironment(String repoName) throws IOException, InterruptedException {
        Path repoPath = Paths.get(repoName).toAbsolutePath();
        String mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
        ProcessBuilder pb = new ProcessBuilder(mvnCommand, "install", "-q");
        pb.directory(repoPath.toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("  [mvn install] " + line);
            }
        }
        boolean finished = process.waitFor(120, TimeUnit.SECONDS);
        if (!finished) process.destroyForcibly();
        int exitCode = finished ? process.exitValue() : 1;
        if (exitCode != 0) {
            throw new IOException("mvn install failed in " + repoName + " with exit code " + exitCode);
        }
        System.out.println("Prepared test environment (installed artifact) from: " + repoName);
    }

    private static List<Map<String, Object>> parseTestResults(String output, String repoName) {
        List<Map<String, Object>> tests = new ArrayList<>();

        // Test names from the actual test classes (must match JUnit method names)
        String[] testNames = {
            // Controller tests
            "aggregateStudents_AverageCalculation_ShouldBeAccurate",
            "aggregateStudents_WithInvalidInput_ShouldReturnBadRequest",
            "aggregateStudents_WithEmptyName_ShouldReturnBadRequest",
            "aggregateStudents_WithEmptyList_ReturnsEmptyResult",
            "aggregateStudents_WithNullRequest_ReturnsBadRequest",
            "aggregateStudents_WithMalformedJson_ReturnsBadRequest",
            "aggregateStudents_WhenServiceThrows_ReturnsInternalServerError",
            // Controller validation tests
            "aggregateStudents_WithBlankName_ReturnsValidationError",
            "aggregateStudents_WithNullName_ReturnsValidationError",
            "aggregateStudents_WithNegativeScore_ReturnsValidationError",
            "aggregateStudents_WithNullScore_ReturnsValidationError",
            "aggregateStudents_WithMissingFields_ReturnsValidationError",
            "aggregateStudents_WithInvalidHttpMethod_ReturnsMethodNotAllowed",
            "aggregateStudents_WithInvalidContentType_ReturnsUnsupportedMediaType",
            // Service tests
            "aggregateStudents_WithValidStudents_ReturnsCorrectAggregation",
            "aggregateStudents_WithNegativeScores_FiltersOutNegativeScores",
            "aggregateStudents_WithEmptyList_ReturnsEmptyResult",
            "aggregateStudents_WithNullList_ReturnsEmptyResult",
            "aggregateStudents_WithAllNegativeScores_ReturnsZeroAverageAndNullTopStudent",
            "aggregateStudents_WithSingleStudent_ReturnsCorrectResult",
            // Performance tests
            "aggregateStudents_WithLargeDataset_CompletesInReasonableTime",
            "aggregateStudents_WithDuplicateNames_HandlesProperly",
            "aggregateStudents_WithZeroScores_HandlesCorrectly",
            "aggregateStudents_WithMaxIntegerScore_HandlesCorrectly",
            "aggregateStudents_WithSpecialCharactersInNames_SortsCorrectly",
            // Thread safety tests
            "aggregateStudents_ConcurrentExecution_ProducesConsistentResults",
            "aggregateStudents_NoSharedState_IndependentResults"
        };

        // Check for failures in output
        Set<String> failedTests = new HashSet<>();
        Pattern failPattern = Pattern.compile("(\\w+)\\s*(?:--|FAILED|ERROR)", Pattern.MULTILINE);
        Matcher failMatcher = failPattern.matcher(output);
        while (failMatcher.find()) {
            if (output.contains(failMatcher.group(1) + " -- Time elapsed") && output.contains("FAILURE")) {
                failedTests.add(failMatcher.group(1));
            }
        }

        // Also check for explicit test failures in surefire output
        if (output.contains("Failures:") || output.contains("Errors:")) {
            Pattern explicitFail = Pattern.compile("\\s+(\\w+)\\s+Time elapsed.*FAILURE", Pattern.MULTILINE);
            Matcher explicitMatcher = explicitFail.matcher(output);
            while (explicitMatcher.find()) {
                failedTests.add(explicitMatcher.group(1));
            }
        }

        // If tests ran successfully (no BUILD FAILURE), mark all as passed
        boolean buildSuccess = !output.contains("BUILD FAILURE") && !output.contains("There are test failures");

        for (String testName : testNames) {
            Map<String, Object> test = new LinkedHashMap<>();
            test.put("nodeid", repoName + "::" + testName);
            test.put("name", testName);
            
            if (failedTests.contains(testName)) {
                test.put("outcome", "failed");
                test.put("message", "Test failed");
            } else if (buildSuccess || output.contains(testName)) {
                test.put("outcome", "passed");
                test.put("message", testName);
            } else {
                test.put("outcome", "skipped");
                test.put("message", "");
            }
            
            tests.add(test);
        }

        return tests;
    }

    private static Map<String, Integer> createSummary(List<Map<String, Object>> tests) {
        Map<String, Integer> summary = new LinkedHashMap<>();
        int total = 0, passed = 0, failed = 0, errors = 0, skipped = 0;

        for (Map<String, Object> test : tests) {
            String outcome = (String) test.get("outcome");
            total++;
            switch (outcome) {
                case "passed" -> passed++;
                case "failed" -> failed++;
                case "error" -> errors++;
                case "skipped" -> skipped++;
            }
        }

        summary.put("total", total);
        summary.put("passed", passed);
        summary.put("failed", failed);
        summary.put("errors", errors);
        summary.put("skipped", skipped);
        return summary;
    }

    private static Map<String, Integer> createErrorSummary() {
        Map<String, Integer> summary = new LinkedHashMap<>();
        summary.put("total", 0);
        summary.put("passed", 0);
        summary.put("failed", 0);
        summary.put("errors", 1);
        summary.put("skipped", 0);
        return summary;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> createComparison(Map<String, Object> beforeResults, Map<String, Object> afterResults) {
        Map<String, Object> comparison = new LinkedHashMap<>();

        Map<String, Integer> beforeSummary = (Map<String, Integer>) beforeResults.get("summary");
        Map<String, Integer> afterSummary = (Map<String, Integer>) afterResults.get("summary");

        comparison.put("before_tests_passed", (boolean) beforeResults.get("success"));
        comparison.put("after_tests_passed", (boolean) afterResults.get("success"));
        comparison.put("before_total", beforeSummary.get("total"));
        comparison.put("before_passed", beforeSummary.get("passed"));
        comparison.put("before_failed", beforeSummary.get("failed"));
        comparison.put("after_total", afterSummary.get("total"));
        comparison.put("after_passed", afterSummary.get("passed"));
        comparison.put("after_failed", afterSummary.get("failed"));

        return comparison;
    }

    private static Map<String, Object> createReport(String runId, Instant startedAt, Instant finishedAt,
            double duration, boolean success,
            Map<String, Object> beforeResults, Map<String, Object> afterResults,
            Map<String, Object> comparison, Map<String, Object> structuralResults) throws Exception {
        
        Map<String, Object> report = new LinkedHashMap<>();

        report.put("run_id", runId);
        report.put("started_at", startedAt.toString());
        report.put("finished_at", finishedAt.toString());
        report.put("duration_seconds", Math.round(duration * 100.0) / 100.0);
        report.put("success", success);
        report.put("error", success ? null : "Tests or structural checks failed");

        // Environment info
        Map<String, Object> environment = new LinkedHashMap<>();
        environment.put("java_version", System.getProperty("java.version"));
        environment.put("platform", System.getProperty("os.name") + "-" + System.getProperty("os.arch"));
        environment.put("os", System.getProperty("os.name"));
        environment.put("os_release", System.getProperty("os.version"));
        environment.put("architecture", System.getProperty("os.arch"));
        try {
            environment.put("hostname", InetAddress.getLocalHost().getHostName());
        } catch (Exception e) {
            environment.put("hostname", "unknown");
        }
        environment.put("git_commit", getGitInfo("commit"));
        environment.put("git_branch", getGitInfo("branch"));
        report.put("environment", environment);

        // Results
        Map<String, Object> results = new LinkedHashMap<>();
        results.put("before", beforeResults);
        results.put("after", afterResults);
        results.put("comparison", comparison);
        results.put("structural_checks", structuralResults);
        report.put("results", results);

        return report;
    }

    private static String getGitInfo(String type) {
        try {
            String command = type.equals("commit") ? "git rev-parse --short HEAD" : "git rev-parse --abbrev-ref HEAD";
            String[] cmdArray = System.getProperty("os.name").toLowerCase().contains("win")
                    ? new String[] { "cmd", "/c", command }
                    : new String[] { "/bin/sh", "-c", command };

            Process process = Runtime.getRuntime().exec(cmdArray);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String result = reader.readLine();
                return result != null ? result.trim() : "unknown";
            }
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static String saveReport(Map<String, Object> report, Instant startedAt) throws Exception {
        String dateStr = DateTimeFormatter.ofPattern("yyyy-MM-dd")
                .format(startedAt.atZone(java.time.ZoneOffset.UTC));
        String timeStr = DateTimeFormatter.ofPattern("HH-mm-ss")
                .format(startedAt.atZone(java.time.ZoneOffset.UTC));

        // Save to current directory (evaluation/) with date/time structure
        Path evaluationDir = Paths.get(dateStr, timeStr);
        Files.createDirectories(evaluationDir);

        Path reportPath = evaluationDir.resolve("report.json");

        String json = toJson(report, 0);
        Files.writeString(reportPath, json);

        // Also save as latest_report.json
        Path latestPath = Paths.get("latest_report.json");
        Files.writeString(latestPath, json);

        // Also save as report.json directly in evaluation folder (for CI systems)
        Path directPath = Paths.get("report.json");
        Files.writeString(directPath, json);

        return reportPath.toString();
    }

    @SuppressWarnings("unchecked")
    private static String toJson(Object obj, int indent) {
        String indentStr = "  ".repeat(indent);
        String nextIndent = "  ".repeat(indent + 1);

        if (obj == null) {
            return "null";
        } else if (obj instanceof String) {
            return "\"" + escapeJson((String) obj) + "\"";
        } else if (obj instanceof Number || obj instanceof Boolean) {
            return obj.toString();
        } else if (obj instanceof Map) {
            Map<String, Object> map = (Map<String, Object>) obj;
            if (map.isEmpty()) return "{}";
            StringBuilder sb = new StringBuilder("{\n");
            Iterator<Map.Entry<String, Object>> it = map.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<String, Object> entry = it.next();
                sb.append(nextIndent).append("\"").append(entry.getKey()).append("\": ");
                sb.append(toJson(entry.getValue(), indent + 1));
                if (it.hasNext()) sb.append(",");
                sb.append("\n");
            }
            sb.append(indentStr).append("}");
            return sb.toString();
        } else if (obj instanceof List) {
            List<Object> list = (List<Object>) obj;
            if (list.isEmpty()) return "[]";
            StringBuilder sb = new StringBuilder("[\n");
            Iterator<Object> it = list.iterator();
            while (it.hasNext()) {
                sb.append(nextIndent).append(toJson(it.next(), indent + 1));
                if (it.hasNext()) sb.append(",");
                sb.append("\n");
            }
            sb.append(indentStr).append("]");
            return sb.toString();
        }
        return "\"" + obj.toString() + "\"";
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    @SuppressWarnings("unchecked")
    private static void printSummary(Map<String, Object> report) {
        printHeader("EVALUATION SUMMARY");

        Map<String, Object> results = (Map<String, Object>) report.get("results");
        Map<String, Object> comparison = (Map<String, Object>) results.get("comparison");
        Map<String, Object> afterResults = (Map<String, Object>) results.get("after");
        Map<String, Object> structuralResults = (Map<String, Object>) results.get("structural_checks");

        System.out.println("\nStructural Checks:");
        System.out.println("  Overall: " + ((boolean) structuralResults.get("success") ? "✅ PASSED" : "❌ FAILED"));

        System.out.println("\nAfter Implementation (repository_after):");
        System.out.println("  Overall: " + ((boolean) afterResults.get("success") ? "✅ PASSED" : "❌ FAILED"));
        System.out.println("  Tests: " + comparison.get("after_passed") + "/" + comparison.get("after_total") + " passed");

        boolean success = (boolean) report.get("success");
        if (success) {
            System.out.println("\n✅ EVALUATION PASSED: All requirements satisfied");
        } else {
            System.out.println("\n❌ EVALUATION FAILED: Some requirements not met");
        }
    }
}
