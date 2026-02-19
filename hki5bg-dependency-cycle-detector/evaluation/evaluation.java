import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Java evaluator for this project.
 *
 * <p>Runs Maven tests against repository_after (and optionally repository_before if it contains Java files),
 * parses Surefire XML reports, and writes a JSON report to evaluation/reports/YYYY-MM-DD/HH-MM-SS/report.json.
 *
 * <p>Always exits with code 0.
 */
public final class evaluation {

    private static final DateTimeFormatter DATE_DIR = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter TIME_DIR = DateTimeFormatter.ofPattern("HH-mm-ss");

    public static void main(String[] args) {
        try {
            Path projectRoot = resolveProjectRoot();
            String runId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);

            String outputArg = null;
            for (int i = 0; i < args.length; i++) {
                if ("--output".equals(args[i]) && i + 1 < args.length) {
                    outputArg = args[i + 1];
                    i++;
                }
            }

            System.out.println("Starting Dependency Cycle Detector Evaluation [Run ID: " + runId + "]");

            Path repoBefore = projectRoot.resolve("repository_before");
            Path repoAfter = projectRoot.resolve("repository_after");

            Map<String, Object> resultsBefore = null;
            if (Files.isDirectory(repoBefore) && containsJavaFiles(repoBefore)) {
                System.out.println("Running evaluation on BEFORE (Legacy) at " + repoBefore + "...");
                resultsBefore = runVariant(projectRoot, repoBefore);
            } else {
                System.out.println("Skipping BEFORE (empty or missing Java sources).");
            }

            Map<String, Object> resultsAfter;
            if (Files.isDirectory(repoAfter) && containsJavaFiles(repoAfter)) {
                System.out.println("Running evaluation on AFTER (Optimized) at " + repoAfter + "...");
                resultsAfter = runVariant(projectRoot, repoAfter);
            } else {
                resultsAfter = new HashMap<>();
                resultsAfter.put("success", false);
                resultsAfter.put("exit_code", -1);
                resultsAfter.put("tests", List.of());
                resultsAfter.put("summary", Map.of("total", 0, "passed", 0, "failed", 0, "errors", 1, "skipped", 0));
                resultsAfter.put("stdout", "");
                resultsAfter.put("stderr", "repository_after missing or contains no .java files");
            }

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> afterTests = (List<Map<String, Object>>) resultsAfter.getOrDefault("tests", List.of());
            Map<String, Object> criteria = mapCriteria(afterTests);

            Map<String, Object> report = new HashMap<>();
            report.put("run_id", runId);
            report.put("tool", "Dependency Cycle Detector Evaluator");
            report.put("started_at", LocalDateTime.now().toString());
            report.put("environment", environmentInfo());
            report.put("before", resultsBefore);
            report.put("after", resultsAfter);
            report.put("criteria_analysis", criteria);
            report.put("comparison", Map.of(
                    "summary", "Evaluates dependency-cycle detection correctness and scalability.",
                    "success", Boolean.TRUE.equals(resultsAfter.get("success"))
            ));

            Path outputPath = outputArg != null ? Path.of(outputArg) : defaultOutputPath(projectRoot);
            Files.createDirectories(outputPath.getParent());
            Files.writeString(outputPath, toPrettyJson(report), StandardCharsets.UTF_8);

            System.out.println("\nReport saved to: " + outputPath);
        } catch (Exception e) {
            System.out.println("INTERNAL EVALUATION SCRIPT ERROR: " + e);
        }

        // ALWAYS EXIT 0
        System.exit(0);
    }

    private static Path resolveProjectRoot() {
        // This file is in <root>/evaluation/evaluation.java
        Path here = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();

        // Try common invocation points:
        // - project root
        // - evaluation/
        if (Files.isDirectory(here.resolve("evaluation")) && Files.exists(here.resolve("pom.xml"))) {
            return here;
        }
        if (here.getFileName() != null && "evaluation".equals(here.getFileName().toString())) {
            Path parent = here.getParent();
            if (parent != null && Files.exists(parent.resolve("pom.xml"))) {
                return parent;
            }
        }

        // Walk up a few levels looking for pom.xml.
        Path p = here;
        for (int i = 0; i < 5; i++) {
            if (p != null && Files.exists(p.resolve("pom.xml"))) {
                return p;
            }
            p = p.getParent();
        }
        return here;
    }

    private static boolean containsJavaFiles(Path dir) throws IOException {
        try (var stream = Files.walk(dir)) {
            return stream.anyMatch(p -> p.toString().endsWith(".java"));
        }
    }

    private static Path defaultOutputPath(Path projectRoot) {
        LocalDateTime now = LocalDateTime.now();
        return projectRoot
                .resolve("evaluation")
                .resolve("reports")
                .resolve(DATE_DIR.format(now))
                .resolve(TIME_DIR.format(now))
                .resolve("report.json");
    }

    private static Map<String, Object> environmentInfo() {
        Map<String, Object> env = new HashMap<>();
        env.put("os", System.getProperty("os.name"));
        env.put("os_version", System.getProperty("os.version"));
        env.put("java_version", System.getProperty("java.version"));
        env.put("java_vendor", System.getProperty("java.vendor"));
        env.put("platform", System.getProperty("os.arch"));
        env.put("date", LocalDate.now().toString());
        return env;
    }

    private static Map<String, Object> runVariant(Path projectRoot, Path repoVariantDir) throws IOException, InterruptedException {
        // Stage into temp directory and always map the variant sources into repository_after,
        // because pom.xml is configured to compile from repository_after.
        Path tmp = Files.createTempDirectory("java-eval-");

        try {
            copyFile(projectRoot.resolve("pom.xml"), tmp.resolve("pom.xml"));
            copyTree(projectRoot.resolve("tests"), tmp.resolve("tests"));
            copyTree(repoVariantDir, tmp.resolve("repository_after"));

            ProcessResult mvn = runProcess(tmp, List.of("mvn", "-B", "test"), 180);

            SurefireParseResult parsed = parseSurefire(tmp.resolve("target").resolve("surefire-reports"));

            Map<String, Object> result = new HashMap<>();
            result.put("success", mvn.exitCode == 0);
            result.put("exit_code", mvn.exitCode);
            result.put("tests", parsed.tests);
            result.put("summary", parsed.summary);
            result.put("stdout", mvn.stdout);
            result.put("stderr", mvn.stderr);
            return result;
        } finally {
            deleteRecursively(tmp);
        }
    }

    private static ProcessResult runProcess(Path cwd, List<String> command, int timeoutSeconds) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(cwd.toFile());
        pb.redirectErrorStream(false);

        Process p = pb.start();

        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();

        Thread tOut = new Thread(() -> copyStream(p.getInputStream(), stdout));
        Thread tErr = new Thread(() -> copyStream(p.getErrorStream(), stderr));
        tOut.start();
        tErr.start();

        boolean finished = p.waitFor(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
        if (!finished) {
            p.destroyForcibly();
        }
        tOut.join();
        tErr.join();

        int exit = finished ? p.exitValue() : -1;
        return new ProcessResult(exit,
                stdout.toString(StandardCharsets.UTF_8),
                finished ? stderr.toString(StandardCharsets.UTF_8) : "Evaluation timed out (mvn test exceeded " + timeoutSeconds + "s)."
        );
    }

    private static void copyStream(InputStream in, ByteArrayOutputStream out) {
        try {
            in.transferTo(out);
        } catch (IOException e) {
            // best-effort
        }
    }

    private static void copyFile(Path src, Path dst) throws IOException {
        Files.createDirectories(dst.getParent());
        Files.copy(src, dst, StandardCopyOption.REPLACE_EXISTING);
    }

    private static void copyTree(Path src, Path dst) throws IOException {
        if (!Files.exists(src)) {
            return;
        }
        Files.walkFileTree(src, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Path rel = src.relativize(dir);
                Files.createDirectories(dst.resolve(rel));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Path rel = src.relativize(file);
                Files.copy(file, dst.resolve(rel), StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private static void deleteRecursively(Path root) {
        try {
            if (!Files.exists(root)) {
                return;
            }
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            // best-effort cleanup
        }
    }

    private static SurefireParseResult parseSurefire(Path surefireDir) {
        List<Map<String, Object>> tests = new ArrayList<>();
        int total = 0;
        int failed = 0;
        int errors = 0;
        int skipped = 0;

        if (!Files.isDirectory(surefireDir)) {
            return new SurefireParseResult(tests, Map.of("total", 0, "passed", 0, "failed", 0, "errors", 0, "skipped", 0));
        }

        try {
            var xmlFiles = Files.list(surefireDir)
                    .filter(p -> p.getFileName().toString().startsWith("TEST-") && p.getFileName().toString().endsWith(".xml"))
                    .toList();

            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setExpandEntityReferences(false);
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);

            for (Path xml : xmlFiles) {
                DocumentBuilder db = dbf.newDocumentBuilder();
                Document doc = db.parse(xml.toFile());
                Element suite = doc.getDocumentElement();

                NodeList cases = suite.getElementsByTagName("testcase");
                for (int i = 0; i < cases.getLength(); i++) {
                    Element tc = (Element) cases.item(i);
                    String classname = tc.getAttribute("classname");
                    String name = tc.getAttribute("name");
                    String nodeid = classname + "#" + name;

                    String outcome = "passed";
                    if (tc.getElementsByTagName("skipped").getLength() > 0) {
                        outcome = "skipped";
                        skipped++;
                    } else if (tc.getElementsByTagName("failure").getLength() > 0) {
                        outcome = "failed";
                        failed++;
                    } else if (tc.getElementsByTagName("error").getLength() > 0) {
                        outcome = "error";
                        errors++;
                    }

                    Map<String, Object> t = new HashMap<>();
                    t.put("nodeid", nodeid);
                    t.put("name", name);
                    t.put("classname", classname);
                    t.put("outcome", outcome);
                    tests.add(t);
                    total++;
                }
            }
        } catch (Exception e) {
            // If parsing fails, return what we have.
        }

        int passed = Math.max(0, total - failed - errors - skipped);
        Map<String, Object> summary = Map.of(
                "total", total,
                "passed", passed,
                "failed", failed,
                "errors", errors,
                "skipped", skipped
        );
        return new SurefireParseResult(tests, summary);
    }

    private static Map<String, Object> mapCriteria(List<Map<String, Object>> tests) {
        return Map.of(
                "detect_cycles", allPass(tests, "twoNodeCycleIsDetected", "longerCycleIsDetected"),
                "disconnected_graphs", allPass(tests, "disconnectedAcyclicGraphIsAccepted", "cycleInDisconnectedComponentIsDetected"),
                "self_dependency", singleCheck(tests, "selfDependencyIsCycle"),
                "scales_large_inputs", allPass(tests, "scalesToLargeInputChainWithoutCycle", "scalesToLargeInputWithCycle")
        );
    }

    private static String singleCheck(List<Map<String, Object>> tests, String nameFragment) {
        for (Map<String, Object> t : tests) {
            Object nameObj = t.get("name");
            if (nameObj != null && nameObj.toString().contains(nameFragment)) {
                return "passed".equals(t.get("outcome")) ? "Pass" : "Fail";
            }
        }
        return "Not Run";
    }

    private static String allPass(List<Map<String, Object>> tests, String... fragments) {
        boolean anyNotRun = false;
        for (String fragment : fragments) {
            String r = singleCheck(tests, fragment);
            if ("Not Run".equals(r)) {
                anyNotRun = true;
            } else if ("Fail".equals(r)) {
                return "Fail";
            }
        }
        return anyNotRun ? "Not Run" : "Pass";
    }

    // Minimal JSON writer (pretty-printed) to avoid adding extra dependencies.
    private static String toPrettyJson(Object value) {
        StringBuilder sb = new StringBuilder(16_384);
        writeJson(value, sb, 0);
        sb.append('\n');
        return sb.toString();
    }

    private static void writeJson(Object value, StringBuilder out, int indentLevel) {
        if (value == null) {
            out.append("null");
            return;
        }
        if (value instanceof String s) {
            out.append('"').append(escapeJson(s)).append('"');
            return;
        }
        if (value instanceof Number || value instanceof Boolean) {
            out.append(value);
            return;
        }
        if (value instanceof Map<?, ?> map) {
            out.append('{');
            if (map.isEmpty()) {
                out.append('}');
                return;
            }
            out.append('\n');
            boolean first = true;
            for (Map.Entry<?, ?> e : map.entrySet()) {
                if (!first) {
                    out.append(",\n");
                }
                first = false;
                indent(out, indentLevel + 1);
                out.append('"').append(escapeJson(String.valueOf(e.getKey()))).append('"').append(": ");
                writeJson(e.getValue(), out, indentLevel + 1);
            }
            out.append('\n');
            indent(out, indentLevel);
            out.append('}');
            return;
        }
        if (value instanceof List<?> list) {
            out.append('[');
            if (list.isEmpty()) {
                out.append(']');
                return;
            }
            out.append('\n');
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) {
                    out.append(",\n");
                }
                indent(out, indentLevel + 1);
                writeJson(list.get(i), out, indentLevel + 1);
            }
            out.append('\n');
            indent(out, indentLevel);
            out.append(']');
            return;
        }
        // Fallback
        out.append('"').append(escapeJson(String.valueOf(value))).append('"');
    }

    private static void indent(StringBuilder out, int indentLevel) {
        for (int i = 0; i < indentLevel; i++) {
            out.append("  ");
        }
    }

    private static String escapeJson(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    private record ProcessResult(int exitCode, String stdout, String stderr) {
    }

    private record SurefireParseResult(List<Map<String, Object>> tests, Map<String, Object> summary) {
    }
}
