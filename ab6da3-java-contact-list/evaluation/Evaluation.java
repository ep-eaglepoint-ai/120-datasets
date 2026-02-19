import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Java-only evaluation runner.
 *
 * Contract:
 * - repository_before is expected to FAIL the test suite
 * - repository_after is expected to PASS the test suite
 *
 * Artifacts:
 * - evaluation/reports/<YYYY-MM-DD>/<HH-MM-SS>/report.json
 * - evaluation/reports/latest.json
 * - evaluation/reports/report.json
 */
public final class Evaluation {
  private Evaluation() {}

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);
  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH-mm-ss").withZone(ZoneOffset.UTC);

  public static void main(String[] args) throws Exception {
    Path root = Path.of(".").toAbsolutePath().normalize();
    Path repoBefore = root.resolve("repository_before");
    Path repoAfter = root.resolve("repository_after");
    Path reportsRoot = root.resolve("evaluation").resolve("reports");

    String startedAt = Instant.now().toString();

    System.out.println("============================================================");
    System.out.println("Java Contacts Evaluation");
    System.out.println("============================================================");

    System.out.println("\n[1/2] Running tests on repository_before (expected to FAIL)...");
    RunTests.RunResult before = RunTests.runForRepo(repoBefore);
    System.out.print(before.output);

    System.out.println("\n[2/2] Running tests on repository_after (expected to PASS)...");
    RunTests.RunResult after = RunTests.runForRepo(repoAfter);
    System.out.print(after.output);

    boolean passedGate = (!before.success) && after.success;
    String finishedAt = Instant.now().toString();

    String reportJson =
        "{\n"
            + "  \"run_id\": "
            + jsonString(Long.toString(System.currentTimeMillis()))
            + ",\n"
            + "  \"started_at\": "
            + jsonString(startedAt)
            + ",\n"
            + "  \"finished_at\": "
            + jsonString(finishedAt)
            + ",\n"
            + "  \"environment\": {\n"
            + "    \"java_version\": "
            + jsonString(System.getProperty("java.version", "unknown"))
            + ",\n"
            + "    \"platform\": "
            + jsonString(System.getProperty("os.name", "unknown") + "-" + System.getProperty("os.arch", "unknown"))
            + "\n"
            + "  },\n"
            + "  \"before\": {\n"
            + "    \"tests\": {\n"
            + "      \"success\": "
            + bool(before.success)
            + ",\n"
            + "      \"exit_code\": "
            + before.exitCode
            + "\n"
            + "    },\n"
            + "    \"output\": "
            + jsonString(truncate(before.output, 8000))
            + "\n"
            + "  },\n"
            + "  \"after\": {\n"
            + "    \"tests\": {\n"
            + "      \"success\": "
            + bool(after.success)
            + ",\n"
            + "      \"exit_code\": "
            + after.exitCode
            + "\n"
            + "    },\n"
            + "    \"output\": "
            + jsonString(truncate(after.output, 8000))
            + "\n"
            + "  },\n"
            + "  \"comparison\": {\n"
            + "    \"passed_gate\": "
            + bool(passedGate)
            + ",\n"
            + "    \"improvement_summary\": "
            + jsonString(passedGate ? "After implementation passed correctness checks." : "Gate failed.")
            + "\n"
            + "  },\n"
            + "  \"success\": "
            + bool(passedGate)
            + "\n"
            + "}\n";

    writeReports(reportsRoot, reportJson);

    System.out.println("\n============================================================");
    System.out.println("Evaluation Complete");
    System.out.println("============================================================");
    System.out.println("passed_gate: " + passedGate);

    System.exit(passedGate ? 0 : 1);
  }

  private static void writeReports(Path reportsRoot, String reportJson) throws IOException {
    Instant now = Instant.now();
    Path datedDir = reportsRoot.resolve(DATE.format(now)).resolve(TIME.format(now));
    Files.createDirectories(datedDir);
    Files.createDirectories(reportsRoot);

    Files.writeString(datedDir.resolve("report.json"), reportJson, StandardCharsets.UTF_8);
    Files.writeString(reportsRoot.resolve("latest.json"), reportJson, StandardCharsets.UTF_8);
    Files.writeString(reportsRoot.resolve("report.json"), reportJson, StandardCharsets.UTF_8);
  }

  private static String truncate(String s, int max) {
    if (s == null) return "";
    if (s.length() <= max) return s;
    return s.substring(0, max);
  }

  private static String bool(boolean v) {
    return v ? "true" : "false";
  }

  private static String jsonString(String s) {
    return "\"" + jsonEscape(s) + "\"";
  }

  private static String jsonEscape(String s) {
    if (s == null) return "";
    StringBuilder out = new StringBuilder(s.length() + 16);
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '\\' -> out.append("\\\\");
        case '"' -> out.append("\\\"");
        case '\n' -> out.append("\\n");
        case '\r' -> out.append("\\r");
        case '\t' -> out.append("\\t");
        default -> {
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
        }
      }
    }
    return out.toString();
  }
}

