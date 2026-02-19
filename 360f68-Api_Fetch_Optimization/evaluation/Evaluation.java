import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class Evaluation {
    
    private static final String PROJECT_ROOT = System.getProperty("user.dir");
    private static final String REPORTS_DIR = "evaluation/reports";
    
    public static void main(String[] args) {
        long startTime = System.currentTimeMillis();
        String runId = UUID.randomUUID().toString();
        Instant startedAt = Instant.now();
        TestResult beforeResult = null;
        TestResult afterResult = null;
        
        try {
            System.out.println("[eval] Starting evaluation...");
            
            // Run tests for repository_before
            System.out.println("[eval] Running tests for repository_before...");
            try {
                beforeResult = runTests("repository_before");
            } catch (Exception e) {
                System.err.println("[eval] Error running repository_before tests: " + e.getMessage());
                e.printStackTrace();
                beforeResult = new TestResult(false, "ERROR: " + e.getMessage(), new HashMap<>());
            }
            
            // Run tests for repository_after
            System.out.println("[eval] Running tests for repository_after...");
            try {
                afterResult = runTests("repository_after");
            } catch (Exception e) {
                System.err.println("[eval] Error running repository_after tests: " + e.getMessage());
                e.printStackTrace();
                afterResult = new TestResult(false, "ERROR: " + e.getMessage(), new HashMap<>());
            }
            
            // Always generate report, even if tests failed
            System.out.println("[eval] Generating report...");
            if (beforeResult != null && afterResult != null) {
                generateReport(runId, startedAt, beforeResult, afterResult);
            } else {
                // Fallback: generate error report if we couldn't get results
                throw new Exception("Failed to get test results for both repositories");
            }
            
            long duration = System.currentTimeMillis() - startTime;
            System.out.println("[eval] Evaluation completed in " + duration + "ms");
            System.out.println("[eval] Report generated at: evaluation/report.json");
            
            System.exit(afterResult.passed ? 0 : 1);
            
        } catch (Exception e) {
            System.err.println("[eval] Fatal Error: " + e.getMessage());
            e.printStackTrace();
            generateErrorReport(runId, startedAt, e);
            System.exit(1);
        }
    }
    
    private static TestResult runTests(String repository) throws Exception {
        String testOutput = compileAndRunTests(repository);
        
        // Parse JUnit 5 ConsoleLauncher output
        // Look for test summary: "tests successful" vs "tests failed"
        boolean passed = false;
        if (testOutput.contains("COMPILATION FAILED")) {
            passed = false;
        } else {
            // JUnit 5 output format: "[ X tests successful ]" and "[ Y tests failed ]"
            // Extract actual numbers to determine if tests passed
            java.util.regex.Pattern successPattern = java.util.regex.Pattern.compile("\\[\\s*(\\d+)\\s+tests\\s+successful\\s*\\]");
            java.util.regex.Pattern failedPattern = java.util.regex.Pattern.compile("\\[\\s*(\\d+)\\s+tests\\s+failed\\s*\\]");
            
            java.util.regex.Matcher successMatcher = successPattern.matcher(testOutput);
            java.util.regex.Matcher failedMatcher = failedPattern.matcher(testOutput);
            
            int testsSuccessful = 0;
            int testsFailed = 0;
            boolean foundResults = false;
            
            if (successMatcher.find()) {
                testsSuccessful = Integer.parseInt(successMatcher.group(1));
                foundResults = true;
            }
            if (failedMatcher.find()) {
                testsFailed = Integer.parseInt(failedMatcher.group(1));
                foundResults = true;
            }
            
            // Pass if we found test results and all passed (or no test output but compilation succeeded)
            if (foundResults) {
                passed = testsSuccessful > 0 && testsFailed == 0;
            } else {
                // Fallback: if no explicit failure indicators and compilation succeeded, assume passed
                passed = !testOutput.contains("error:") && !testOutput.contains("Exception") && 
                        !testOutput.contains("containers failed");
            }
        }
        
        // Parse test results if available
        Map<String, Object> testDetails = new HashMap<>();
        testDetails.put("output", testOutput);
        testDetails.put("passed", passed);
        
        return new TestResult(passed, testOutput, testDetails);
    }
    
    private static String compileAndRunTests(String repository) throws Exception {
        ProcessBuilder pb = new ProcessBuilder();
        pb.directory(new File(PROJECT_ROOT));
        
        // Create output directory
        Path classesDir = Paths.get("/tmp/classes");
        Files.createDirectories(classesDir);
        
        List<String> compileCmd = new ArrayList<>();
        compileCmd.add("javac");
        compileCmd.add("-cp");
        compileCmd.add(".:/opt/junit-platform-console-standalone.jar");
        compileCmd.add("-d");
        compileCmd.add("/tmp/classes");
        
        // Handle repository_before (just a method, need wrapper)
        if ("repository_before".equals(repository)) {
            // Create wrapper class
            Path wrapperDir = Files.createTempDirectory("before_wrapper");
            Path wrapperFile = wrapperDir.resolve("FetchOptimization.java");
            String wrapperCode = 
                "import java.util.ArrayList;\n" +
                "import java.util.List;\n" +
                "public class FetchOptimization {\n" +
                "    public static List<Object> fetchItems(List<Object> items) {\n" +
                "        List<Object> result = new ArrayList<>();\n" +
                "        for (int i = 0; i < items.size(); i++) {\n" +
                "            if (!result.contains(items.get(i))) {\n" +
                "                result.add(items.get(i));\n" +
                "            }\n" +
                "        }\n" +
                "        return result;\n" +
                "    }\n" +
                "    public static List<Object> fetchItems(List<Object> items, Integer page, Integer pageSize) {\n" +
                "        throw new UnsupportedOperationException(\"Pagination not supported in repository_before\");\n" +
                "    }\n" +
                "}\n";
            Files.write(wrapperFile, wrapperCode.getBytes());
            compileCmd.add(wrapperFile.toString());
        } else {
            // For repository_after, use lowercase filename (naming convention)
            Path sourceFile = Paths.get(PROJECT_ROOT, repository, "fetchOptimization.java");
            if (!Files.exists(sourceFile)) {
                throw new FileNotFoundException("Source file not found: " + sourceFile + 
                    ". Current directory: " + PROJECT_ROOT);
            }
            compileCmd.add(sourceFile.toString());
        }
        
        // Add test file with absolute path
        Path testFile = Paths.get(PROJECT_ROOT, "tests", "FetchOptimizationTest.java");
        if (!Files.exists(testFile)) {
            throw new FileNotFoundException("Test file not found: " + testFile);
        }
        compileCmd.add(testFile.toString());
        
        Process compileProcess = new ProcessBuilder(compileCmd)
            .redirectErrorStream(true)
            .start();
        
        String compileOutput = readProcessOutput(compileProcess);
        int compileExitCode = compileProcess.waitFor();
        
        if (compileExitCode != 0) {
            return "COMPILATION FAILED\n" + compileOutput;
        }
        
        // Run tests
        List<String> runCmd = new ArrayList<>();
        runCmd.add("java");
        runCmd.add("-cp");
        runCmd.add("/tmp/classes:/opt/junit-platform-console-standalone.jar");
        runCmd.add("org.junit.platform.console.ConsoleLauncher");
        runCmd.add("--class-path=/tmp/classes");
        runCmd.add("--select-class=FetchOptimizationTest");
        
        Process runProcess = new ProcessBuilder(runCmd)
            .redirectErrorStream(true)
            .start();
        
        String runOutput = readProcessOutput(runProcess);
        int runExitCode = runProcess.waitFor();
        
        return compileOutput + "\n" + runOutput;
    }
    
    private static String readProcessOutput(Process process) throws IOException {
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
        }
        return output.toString();
    }
    
    private static void generateReport(String runId, Instant startedAt, 
                                      TestResult before, TestResult after) throws Exception {
        Instant finishedAt = Instant.now();
        long durationSeconds = Duration.between(startedAt, finishedAt).getSeconds();
        
        // Create reports directory structure
        LocalDateTime now = LocalDateTime.now();
        String dateDir = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        String timeDir = now.format(DateTimeFormatter.ofPattern("HH-mm-ss"));
        Path reportPath = Paths.get(REPORTS_DIR, dateDir, timeDir);
        Files.createDirectories(reportPath);
        
        // Build JSON report manually
        StringBuilder json = new StringBuilder();
        json.append("{\n");
        json.append("  \"run_id\": \"").append(runId).append("\",\n");
        json.append("  \"started_at\": \"").append(startedAt.toString()).append("\",\n");
        json.append("  \"finished_at\": \"").append(finishedAt.toString()).append("\",\n");
        json.append("  \"duration_seconds\": ").append(durationSeconds).append(",\n");
        
        // Environment info
        json.append("  \"environment\": {\n");
        json.append("    \"java_version\": \"").append(System.getProperty("java.version")).append("\",\n");
        json.append("    \"platform\": \"").append(System.getProperty("os.name"))
             .append("-").append(System.getProperty("os.arch")).append("\"\n");
        json.append("  },\n");
        
        // Before results
        json.append("  \"before\": {\n");
        json.append("    \"tests\": {\n");
        json.append("      \"output\": ").append(escapeJson(before.output)).append(",\n");
        json.append("      \"passed\": ").append(before.passed).append("\n");
        json.append("    },\n");
        json.append("    \"metrics\": {}\n");
        json.append("  },\n");
        
        // After results
        json.append("  \"after\": {\n");
        json.append("    \"tests\": {\n");
        json.append("      \"output\": ").append(escapeJson(after.output)).append(",\n");
        json.append("      \"passed\": ").append(after.passed).append("\n");
        json.append("    },\n");
        json.append("    \"metrics\": {}\n");
        json.append("  },\n");
        
        // Comparison
        json.append("  \"comparison\": {\n");
        json.append("    \"passed_gate\": ").append(after.passed).append("\n");
        json.append("  },\n");
        
        // Success flag
        json.append("  \"success\": ").append(after.passed).append(",\n");
        json.append("  \"error\": ").append(after.passed ? "null" : "\"Tests failed\"").append("\n");
        json.append("}");
        
        // Write report 
        Path reportFile = reportPath.resolve("report.json");
        Files.write(reportFile, json.toString().getBytes());
        
        // Also write to simple location for easy access (like email parser)
        Path simpleReportFile = Paths.get("evaluation/report.json");
        Files.createDirectories(simpleReportFile.getParent());
        Files.write(simpleReportFile, json.toString().getBytes());
        
        System.out.println("[eval] Report written to: " + reportFile);
        System.out.println("[eval] Latest report also at: " + simpleReportFile);
    }
    
    private static void generateErrorReport(String runId, Instant startedAt, Exception error) {
        try {
            Instant finishedAt = Instant.now();
            LocalDateTime now = LocalDateTime.now();
            String dateDir = now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            String timeDir = now.format(DateTimeFormatter.ofPattern("HH-mm-ss"));
            Path reportPath = Paths.get(REPORTS_DIR, dateDir, timeDir);
            Files.createDirectories(reportPath);
            
            StringBuilder json = new StringBuilder();
            json.append("{\n");
            json.append("  \"run_id\": \"").append(runId).append("\",\n");
            json.append("  \"started_at\": \"").append(startedAt.toString()).append("\",\n");
            json.append("  \"finished_at\": \"").append(Instant.now().toString()).append("\",\n");
            json.append("  \"duration_seconds\": ").append(Duration.between(startedAt, Instant.now()).getSeconds()).append(",\n");
            json.append("  \"success\": false,\n");
            json.append("  \"error\": \"").append(escapeJson(error.getMessage())).append("\"\n");
            json.append("}");
            
            Path reportFile = reportPath.resolve("report.json");
            Files.write(reportFile, json.toString().getBytes());
            
            // Also write to simple location for easy access
            Path simpleReportFile = Paths.get("evaluation/report.json");
            Files.createDirectories(simpleReportFile.getParent());
            Files.write(simpleReportFile, json.toString().getBytes());
        } catch (Exception e) {
            System.err.println("Failed to write error report: " + e.getMessage());
        }
    }
    
    private static String escapeJson(String str) {
        if (str == null) return "null";
        return "\"" + str.replace("\\", "\\\\")
                        .replace("\"", "\\\"")
                        .replace("\n", "\\n")
                        .replace("\r", "\\r")
                        .replace("\t", "\\t") + "\"";
    }
    
    private static class TestResult {
        boolean passed;
        String output;
        Map<String, Object> testDetails;
        
        TestResult(boolean passed, String output, Map<String, Object> testDetails) {
            this.passed = passed;
            this.output = output;
            this.testDetails = testDetails;
        }
    }
}
