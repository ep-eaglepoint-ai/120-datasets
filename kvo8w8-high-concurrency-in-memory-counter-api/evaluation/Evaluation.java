package evaluation;

import java.io.*;
import java.net.InetAddress;
import java.nio.file.*;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.*;

/**
 * Evaluation script for High Concurrency Counter API.
 * Runs tests against repository_before and repository_after,
 * then generates a JSON report comparing the results.
 */
public class Evaluation {

    private static final String TASK_NAME = "High Concurrency Counter API Optimization";
    private static final String REPOSITORY_BEFORE = "repository_before";
    private static final String REPOSITORY_AFTER = "repository_after";

    public static void main(String[] args) {
        try {
            String runId = generateRunId();
            Instant startedAt = Instant.now();

            printHeader("EVALUATION: " + TASK_NAME);
            System.out.println("Run ID: " + runId);
            System.out.println("Started at: " + startedAt);

            // Run tests for both repositories
            Map<String, Object> beforeResults = runTests(REPOSITORY_BEFORE);
            Map<String, Object> afterResults = runTests(REPOSITORY_AFTER);

            Instant finishedAt = Instant.now();
            double duration = (finishedAt.toEpochMilli() - startedAt.toEpochMilli()) / 1000.0;

            // Create comparison
            Map<String, Object> comparison = createComparison(beforeResults, afterResults);

            // Determine overall success (after tests should pass)
            boolean success = (boolean) afterResults.get("success");

            // Create and save report
            Map<String, Object> report = createReport(runId, startedAt, finishedAt, duration,
                    success, beforeResults, afterResults, comparison);

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

    private static Map<String, Object> runTests(String repoName) throws Exception {
        printHeader("RUNNING TESTS: " + repoName);

        Map<String, Object> result = new LinkedHashMap<>();

        try {
            // Prepare source code for this repository
            prepareSourceCode(repoName);

            // Determine the working directory (where pom.xml should be)
            Path workDir = findMavenProjectRoot();

            // Run Maven tests with REPO_PATH environment variable
            ProcessBuilder pb = new ProcessBuilder();

            // Use mvn.cmd on Windows, mvn on Unix
            String mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
            pb.command(mvnCommand, "clean", "test", "-Dtest=CounterControllerTest", "-q");
            pb.directory(workDir.toFile());
            pb.environment().put("REPO_PATH", repoName);
            pb.redirectErrorStream(true);

            System.out.println("Working directory: " + workDir);
            System.out.println("Running: mvn clean test -Dtest=CounterControllerTest");
            System.out.println("REPO_PATH: " + repoName);

            Process process = pb.start();

            StringBuilder outputBuilder = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    outputBuilder.append(line).append("\n");
                    System.out.println(line);
                }
            }

            boolean finished = process.waitFor(300, TimeUnit.SECONDS);
            int exitCode = finished ? process.exitValue() : 1;

            if (!finished) {
                process.destroyForcibly();
            }

            String output = outputBuilder.toString();

            // Parse test results from Surefire reports or output
            List<Map<String, Object>> tests = parseTestResults(workDir, output, repoName);
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

    private static Path findMavenProjectRoot() throws IOException {
        // Check if pom.xml exists in current directory
        Path currentDir = Paths.get("").toAbsolutePath();

        if (Files.exists(currentDir.resolve("pom.xml"))) {
            return currentDir;
        }

        // Check if tests/pom.xml exists (standalone evaluation)
        if (Files.exists(currentDir.resolve("tests/pom.xml"))) {
            // Copy pom.xml to root and setup Maven structure
            setupMavenProject(currentDir);
            return currentDir;
        }

        throw new IOException("Cannot find pom.xml. Run from project root directory.");
    }

    private static void setupMavenProject(Path projectRoot) throws IOException {
        // Copy pom.xml from tests/ to root
        Files.copy(projectRoot.resolve("tests/pom.xml"),
                projectRoot.resolve("pom.xml"),
                StandardCopyOption.REPLACE_EXISTING);

        // Create necessary directories
        Path srcMainJava = projectRoot.resolve("src/main/java/com/example/counter");
        Path srcTestJava = projectRoot.resolve("src/test/java/com/example/counter");

        Files.createDirectories(srcMainJava);
        Files.createDirectories(srcTestJava);

        // Copy test file
        if (Files.exists(projectRoot.resolve("tests/CounterControllerTest.java"))) {
            Files.copy(projectRoot.resolve("tests/CounterControllerTest.java"),
                    srcTestJava.resolve("CounterControllerTest.java"),
                    StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static void prepareSourceCode(String repoName) throws IOException {
        Path projectRoot = Paths.get("").toAbsolutePath();
        Path sourceDir = projectRoot.resolve("src/main/java/com/example/counter");

        // Ensure directory exists
        Files.createDirectories(sourceDir);

        // Clean existing source files
        if (Files.exists(sourceDir)) {
            try (var stream = Files.list(sourceDir)) {
                stream.filter(p -> p.toString().endsWith(".java"))
                        .forEach(p -> {
                            try {
                                Files.delete(p);
                            } catch (IOException e) {
                                // Ignore
                            }
                        });
            }
        }

        Path repoPath = projectRoot.resolve(repoName);

        if ("repository_before".equals(repoName)) {
            // Copy CounterController.java from repository_before
            Path controllerSrc = repoPath.resolve("CounterController.java");
            if (Files.exists(controllerSrc)) {
                Files.copy(controllerSrc, sourceDir.resolve("CounterController.java"),
                        StandardCopyOption.REPLACE_EXISTING);
            }

            // Create basic CounterApplication.java
            String appClass = """
                    package com.example.counter;

                    import org.springframework.boot.SpringApplication;
                    import org.springframework.boot.autoconfigure.SpringBootApplication;

                    @SpringBootApplication
                    public class CounterApplication {
                        public static void main(String[] args) {
                            SpringApplication.run(CounterApplication.class, args);
                        }
                    }
                    """;
            Files.writeString(sourceDir.resolve("CounterApplication.java"), appClass);

        } else {
            // Copy all Java files from repository_after
            if (Files.exists(repoPath)) {
                try (var stream = Files.list(repoPath)) {
                    stream.filter(p -> p.toString().endsWith(".java"))
                            .forEach(p -> {
                                try {
                                    Files.copy(p, sourceDir.resolve(p.getFileName()),
                                            StandardCopyOption.REPLACE_EXISTING);
                                } catch (IOException e) {
                                    throw new UncheckedIOException(e);
                                }
                            });
                }
            }
        }

        System.out.println("Prepared source code from: " + repoName);
    }

    private static List<Map<String, Object>> parseTestResults(Path workDir, String output, String repoName) {
        List<Map<String, Object>> tests = new ArrayList<>();

        // First try to parse from Surefire XML reports
        Path surefireReportsDir = workDir.resolve("target/surefire-reports");
        if (Files.exists(surefireReportsDir)) {
            try {
                tests = parseSurefireReports(surefireReportsDir, repoName);
                if (!tests.isEmpty()) {
                    return tests;
                }
            } catch (Exception e) {
                System.err.println("Warning: Could not parse Surefire reports: " + e.getMessage());
            }
        }

        // Fallback: parse from console output
        tests = parseTestOutputFromConsole(output, repoName);

        return tests;
    }

    private static List<Map<String, Object>> parseSurefireReports(Path reportsDir, String repoName) throws Exception {
        List<Map<String, Object>> tests = new ArrayList<>();

        try (var stream = Files.list(reportsDir)) {
            List<Path> xmlFiles = stream
                    .filter(p -> p.toString().endsWith(".xml") && p.getFileName().toString().startsWith("TEST-"))
                    .toList();

            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            DocumentBuilder builder = factory.newDocumentBuilder();

            for (Path xmlFile : xmlFiles) {
                Document doc = builder.parse(xmlFile.toFile());
                doc.getDocumentElement().normalize();

                NodeList testCases = doc.getElementsByTagName("testcase");
                for (int i = 0; i < testCases.getLength(); i++) {
                    Element testCase = (Element) testCases.item(i);
                    String name = testCase.getAttribute("name");
                    String className = testCase.getAttribute("classname");

                    Map<String, Object> test = new LinkedHashMap<>();
                    test.put("nodeid", "tests/" + getSimpleClassName(className) + ".java::" + name);
                    test.put("name", name);

                    // Check for failure or error
                    NodeList failures = testCase.getElementsByTagName("failure");
                    NodeList errors = testCase.getElementsByTagName("error");
                    NodeList skipped = testCase.getElementsByTagName("skipped");

                    if (failures.getLength() > 0) {
                        test.put("outcome", "failed");
                        test.put("message", failures.item(0).getTextContent());
                    } else if (errors.getLength() > 0) {
                        test.put("outcome", "failed");
                        test.put("message", errors.item(0).getTextContent());
                    } else if (skipped.getLength() > 0) {
                        test.put("outcome", "skipped");
                        test.put("message", "");
                    } else {
                        test.put("outcome", "passed");
                        test.put("message", "");
                    }

                    tests.add(test);
                }
            }
        }

        return tests;
    }

    private static String getSimpleClassName(String fullClassName) {
        int lastDot = fullClassName.lastIndexOf('.');
        return lastDot >= 0 ? fullClassName.substring(lastDot + 1) : fullClassName;
    }

    private static List<Map<String, Object>> parseTestOutputFromConsole(String output, String repoName) {
        List<Map<String, Object>> tests = new ArrayList<>();
        Set<String> processedTests = new HashSet<>();

        // Pattern for JUnit 5 output: testName() ... PASSED/FAILED
        Pattern junit5Pattern = Pattern.compile("(\\w+)\\(\\)\\s+.*?(PASSED|FAILED)", Pattern.MULTILINE);
        Matcher matcher = junit5Pattern.matcher(output);

        while (matcher.find()) {
            String testName = matcher.group(1);
            String outcome = matcher.group(2).toLowerCase();

            if (!processedTests.contains(testName)) {
                Map<String, Object> test = new LinkedHashMap<>();
                test.put("nodeid", "tests/CounterControllerTest.java::" + testName);
                test.put("name", testName);
                test.put("outcome", outcome);
                test.put("message", "");
                tests.add(test);
                processedTests.add(testName);
            }
        }

        // Alternative pattern: Tests run: X, Failures: Y, Errors: Z
        if (tests.isEmpty()) {
            // Look for individual test method execution
            Pattern methodPattern = Pattern.compile("Running (\\w+)\\s*\\.\\.\\.\\s*(OK|FAILURE|ERROR)",
                    Pattern.MULTILINE);
            Matcher methodMatcher = methodPattern.matcher(output);

            while (methodMatcher.find()) {
                String testName = methodMatcher.group(1);
                String result = methodMatcher.group(2);

                if (!processedTests.contains(testName)) {
                    Map<String, Object> test = new LinkedHashMap<>();
                    test.put("nodeid", "tests/CounterControllerTest.java::" + testName);
                    test.put("name", testName);
                    test.put("outcome", result.equals("OK") ? "passed" : "failed");
                    test.put("message", "");
                    tests.add(test);
                    processedTests.add(testName);
                }
            }
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
    private static Map<String, Object> createComparison(Map<String, Object> beforeResults,
            Map<String, Object> afterResults) {
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
            Map<String, Object> comparison) throws Exception {
        Map<String, Object> report = new LinkedHashMap<>();

        report.put("run_id", runId);
        report.put("started_at", startedAt.toString());
        report.put("finished_at", finishedAt.toString());
        report.put("duration_seconds", Math.round(duration * 1000000.0) / 1000000.0);
        report.put("success", success);
        report.put("error", success ? null : "After implementation tests failed");

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

        Path evaluationDir = Paths.get("evaluation", dateStr, timeStr);
        Files.createDirectories(evaluationDir);

        Path reportPath = evaluationDir.resolve("report.json");

        // Write JSON manually (no external dependencies needed)
        String json = toJson(report, 0);
        Files.writeString(reportPath, json);

        // Also save as latest report
        Path latestPath = Paths.get("evaluation", "latest_report.json");
        Files.writeString(latestPath, json);

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
            if (map.isEmpty()) {
                return "{}";
            }
            StringBuilder sb = new StringBuilder("{\n");
            Iterator<Map.Entry<String, Object>> it = map.entrySet().iterator();
            while (it.hasNext()) {
                Map.Entry<String, Object> entry = it.next();
                sb.append(nextIndent).append("\"").append(entry.getKey()).append("\": ");
                sb.append(toJson(entry.getValue(), indent + 1));
                if (it.hasNext()) {
                    sb.append(",");
                }
                sb.append("\n");
            }
            sb.append(indentStr).append("}");
            return sb.toString();
        } else if (obj instanceof List) {
            List<Object> list = (List<Object>) obj;
            if (list.isEmpty()) {
                return "[]";
            }
            StringBuilder sb = new StringBuilder("[\n");
            Iterator<Object> it = list.iterator();
            while (it.hasNext()) {
                sb.append(nextIndent).append(toJson(it.next(), indent + 1));
                if (it.hasNext()) {
                    sb.append(",");
                }
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
        Map<String, Object> beforeResults = (Map<String, Object>) results.get("before");
        Map<String, Object> afterResults = (Map<String, Object>) results.get("after");

        System.out.println("\nBefore Implementation (repository_before):");
        System.out.println("  Overall: " + ((boolean) beforeResults.get("success") ? "✅ PASSED" : "❌ FAILED/SKIPPED"));
        System.out.println("  Tests: " + comparison.get("before_passed") + "/" + comparison.get("before_total") + " passed");

        System.out.println("\nAfter Implementation (repository_after):");
        System.out.println("  Overall: " + ((boolean) afterResults.get("success") ? "✅ PASSED" : "❌ FAILED"));
        System.out.println("  Tests: " + comparison.get("after_passed") + "/" + comparison.get("after_total") + " passed");

        boolean success = (boolean) report.get("success");
        if (success) {
            System.out.println("\n✅ EVALUATION PASSED: Transformation validated successfully");
        } else {
            System.out.println("\n❌ EVALUATION FAILED: Transformation validation failed");
        }
    }
}
