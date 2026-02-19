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

    private static final String TASK_NAME = "Cache Stampede Prevention";
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

            // Run tests for repository_after (CREATION mode - no before tests)
            Map<String, Object> beforeResults = createEmptyBeforeResults();
            Map<String, Object> afterResults = runTests(REPOSITORY_AFTER);

            Instant finishedAt = Instant.now();
            double duration = (finishedAt.toEpochMilli() - startedAt.toEpochMilli()) / 1000.0;

            // Create comparison
            Map<String, Object> comparison = createComparison(beforeResults, afterResults);

            // Determine overall success
            boolean structuralSuccess = (boolean) structuralResults.get("success");
            boolean testSuccess = (boolean) afterResults.get("success");
            boolean success = structuralSuccess && testSuccess;

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

    private static Map<String, Object> createEmptyBeforeResults() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", false);
        result.put("exit_code", 0);
        result.put("tests", new ArrayList<>());
        result.put("summary", createSummary(new ArrayList<>()));
        result.put("stdout", "CREATION mode - no repository_before tests");
        result.put("stderr", "");
        return result;
    }

    private static Map<String, Object> runStructuralChecks() {
        printHeader("STRUCTURAL CHECKS");
        
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, Object>> checks = new ArrayList<>();
        boolean allPassed = true;

        try {
            Path sourceFile = Paths.get(REPOSITORY_AFTER, "src/main/java/cache/SingleFlightCache.java");
            if (!Files.exists(sourceFile)) {
                result.put("success", false);
                result.put("checks", checks);
                result.put("error", "Source file not found: " + sourceFile);
                return result;
            }

            String sourceCode = Files.readString(sourceFile);

            // CHK-01: No busy waiting
            boolean hasBusyWaiting = Pattern.compile("while\\s*\\(\\s*true\\s*\\)\\s*\\{[^}]*Thread\\.sleep", Pattern.DOTALL).matcher(sourceCode).find();
            checks.add(createCheck("CHK-01", "No busy waiting", !hasBusyWaiting));
            if (hasBusyWaiting) allPassed = false;

            // CHK-02: No thread pools
            boolean hasThreadPools = sourceCode.contains("ExecutorService") || sourceCode.contains("ThreadPoolExecutor") || sourceCode.contains("Executors.");
            checks.add(createCheck("CHK-02", "No thread pools", !hasThreadPools));
            if (hasThreadPools) allPassed = false;

            // CHK-03: No background threads
            boolean hasBackgroundThreads = sourceCode.contains("new Thread(") || sourceCode.contains("Thread.start");
            checks.add(createCheck("CHK-03", "No background threads", !hasBackgroundThreads));
            if (hasBackgroundThreads) allPassed = false;

            // CHK-04: Uses ConcurrentHashMap
            boolean usesConcurrentHashMap = sourceCode.contains("ConcurrentHashMap");
            checks.add(createCheck("CHK-04", "Uses ConcurrentHashMap", usesConcurrentHashMap));
            if (!usesConcurrentHashMap) allPassed = false;

            // CHK-05: Uses CompletableFuture
            boolean usesCompletableFuture = sourceCode.contains("CompletableFuture");
            checks.add(createCheck("CHK-05", "Uses CompletableFuture", usesCompletableFuture));
            if (!usesCompletableFuture) allPassed = false;

            // CHK-06: No global synchronization
            boolean hasGlobalLocks = sourceCode.contains("synchronized (this)") || sourceCode.contains("synchronized(this)");
            checks.add(createCheck("CHK-06", "No global synchronization", !hasGlobalLocks));
            if (hasGlobalLocks) allPassed = false;

            // CHK-07: Only Java standard library
            boolean usesOnlyStdLib = true;
            Matcher m = Pattern.compile("import\\s+([^;]+);").matcher(sourceCode);
            while (m.find()) {
                if (!m.group(1).trim().startsWith("java.")) {
                    usesOnlyStdLib = false;
                    break;
                }
            }
            checks.add(createCheck("CHK-07", "Only Java standard library", usesOnlyStdLib));
            if (!usesOnlyStdLib) allPassed = false;

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
            // Install repo under test so tests can import it as dependency
            installRepoUnderTest(repoName);

            Path testsDir = Paths.get(TESTS_DIR).toAbsolutePath().normalize();
            
            ProcessBuilder pb = new ProcessBuilder();
            String mvnCommand = System.getenv("MVN_CMD");
            if (mvnCommand == null || mvnCommand.isEmpty()) mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
            pb.command(mvnCommand, "test", "-q");
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

    private static void installRepoUnderTest(String repoName) throws IOException, InterruptedException {
        Path repoDir = Paths.get(repoName).toAbsolutePath().normalize();
        Path pom = repoDir.resolve("pom.xml");
        if (!Files.exists(pom)) {
            System.out.println("No pom.xml in " + repoName + ", skipping install");
            return;
        }
        String mvnCommand = System.getenv("MVN_CMD");
        if (mvnCommand == null || mvnCommand.isEmpty()) mvnCommand = System.getProperty("os.name").toLowerCase().contains("win") ? "mvn.cmd" : "mvn";
        ProcessBuilder pb = new ProcessBuilder(mvnCommand, "install", "-q");
        pb.directory(repoDir.toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        StringBuilder out = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = r.readLine()) != null) out.append(line).append("\n");
        }
        boolean done = process.waitFor(120, TimeUnit.SECONDS);
        if (!done) {
            process.destroyForcibly();
            process.waitFor(10, TimeUnit.SECONDS);
        }
        int code = process.exitValue();
        if (code != 0) {
            throw new RuntimeException("mvn install failed for " + repoName + " (exit " + code + "): " + out);
        }
        System.out.println("Installed repo under test: " + repoName);
    }

    private static List<Map<String, Object>> parseTestResults(String output, String repoName) {
        List<Map<String, Object>> tests = new ArrayList<>();
        Set<String> processedTests = new HashSet<>();

        // Pattern for test method names from JUnit output
        String[] testNames = {
            "testSingleThreadComputesOnce",
            "testConcurrentAccessComputesOnce",
            "testConcurrentCallersReceiveSameResult",
            "testFailurePropagatedToAllCallers",
            "testComputationExceptionWrapsOriginal",
            "testDifferentKeysDoNotBlock",
            "testHighConcurrencyMultipleKeys",
            "testFailureDoesNotRepeatDuringSameRequest",
            "testCleanupAfterSuccess",
            "testCleanupAfterFailure",
            "testCleanupAllowsRetry",
            "testNullKeyThrowsException",
            "testNullComputeFunctionThrowsException",
            "testNullValueAllowed",
            "testDifferentKeysIndependent",
            "testConstructorWithInitialCapacity",
            "testConstructorRejectsNegativeCapacity",
            "testInterruptedExceptionPropagated",
            "testSequentialRequestsAreSeparate"
        };

        // Check for failures in output
        Set<String> failedTests = new HashSet<>();
        Pattern failPattern = Pattern.compile("(\\w+)\\s*\\(.*?\\)\\s*(?:FAILED|ERROR)", Pattern.MULTILINE);
        Matcher failMatcher = failPattern.matcher(output);
        while (failMatcher.find()) {
            failedTests.add(failMatcher.group(1));
        }

        // If tests ran successfully (no BUILD FAILURE), mark all as passed
        boolean buildSuccess = !output.contains("BUILD FAILURE") && !output.contains("There are test failures");

        for (String testName : testNames) {
            Map<String, Object> test = new LinkedHashMap<>();
            test.put("nodeid", repoName + "::SingleFlightCacheTest::" + testName);
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

        String reportBase = System.getenv("REPORT_DIR");
        if (reportBase == null || reportBase.isEmpty()) reportBase = "reports";
        Path baseDir = Paths.get(reportBase);

        Path evaluationDir = baseDir.resolve(dateStr).resolve(timeStr);
        Files.createDirectories(evaluationDir);

        Path reportPath = evaluationDir.resolve("report.json");

        String json = toJson(report, 0);
        Files.writeString(reportPath, json);

        Path latestPath = baseDir.resolve("latest_report.json");
        Files.writeString(latestPath, json);

        Path directPath = baseDir.resolve("report.json");
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
