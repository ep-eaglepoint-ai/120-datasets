import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Java-only test runner for Contacts.java.
 *
 * Usage:
 *   java -cp /app/bin RunTests /app/repository_after
 *
 * Exit code:
 *   0 -> all tests passed
 *   1 -> failure
 */
public final class RunTests {
  private RunTests() {}

  public static final class RunResult {
    public final boolean success;
    public final int exitCode;
    public final String output;

    public RunResult(boolean success, int exitCode, String output) {
      this.success = success;
      this.exitCode = exitCode;
      this.output = output;
    }
  }

  private static final class TestCase {
    public final String name;
    public final String stdin;
    public final String expectedStdout;

    public TestCase(String name, String stdin, String expectedStdout) {
      this.name = name;
      this.stdin = stdin;
      this.expectedStdout = expectedStdout;
    }
  }

  public static RunResult runForRepo(Path repoPath) {
    List<TestCase> cases = new ArrayList<>();
    cases.add(
        new TestCase(
            "hackerrank_sample",
            String.join(
                "\n",
                "4",
                "add hack",
                "add hackerrank",
                "find hac",
                "find hak",
                ""),
            "2\n0\n"));

    cases.add(
        new TestCase(
            "repeated_inserts_and_prefix_counts",
            String.join(
                "\n",
                "6",
                "add a",
                "add a",
                "add ab",
                "find a",
                "find ab",
                "find b",
                ""),
            "3\n1\n0\n"));

    cases.add(
        new TestCase(
            "tokenized_input_format",
            "3 add hi find h find hi",
            "1\n1\n"));

    StringBuilder out = new StringBuilder();
    out.append("REPO=").append(repoPath).append("\n");

    Path classesDir;
    try {
      classesDir = compileContacts(repoPath);
    } catch (Exception e) {
      out.append("FAIL: javac failed: ").append(e.getMessage()).append("\n");
      return new RunResult(false, 1, out.toString());
    }

    boolean ok = true;
    for (TestCase tc : cases) {
      try {
        ProcResult pr = runContacts(classesDir, repoPath, tc.stdin, Duration.ofSeconds(5));
        if (pr.exitCode != 0) {
          ok = false;
          out.append("FAIL: ").append(tc.name).append(" (exit=").append(pr.exitCode).append(")\n");
          out.append(pr.output).append("\n");
          continue;
        }
        if (!tc.expectedStdout.equals(pr.output)) {
          ok = false;
          out.append("FAIL: ").append(tc.name).append(" (stdout mismatch)\n");
          out.append("EXPECTED:\n").append(tc.expectedStdout).append("\n");
          out.append("GOT:\n").append(pr.output).append("\n");
          continue;
        }
        out.append("PASS: ").append(tc.name).append("\n");
      } catch (Exception e) {
        ok = false;
        out.append("FAIL: ").append(tc.name).append(" (exception: ").append(e).append(")\n");
      }
    }

    return new RunResult(ok, ok ? 0 : 1, out.toString());
  }

  private static Path compileContacts(Path repoPath) throws IOException, InterruptedException {
    Path src = repoPath.resolve("Contacts.java");
    if (!Files.exists(src)) {
      throw new IOException("Missing Contacts.java at " + src);
    }
    Path outDir = Files.createTempDirectory("contacts-classes-");
    ProcessBuilder pb = new ProcessBuilder("javac", "-d", outDir.toString(), src.toString());
    pb.directory(repoPath.toFile());
    pb.redirectErrorStream(true);
    Process p = pb.start();
    String output = readAll(p.getInputStream());
    int code = p.waitFor();
    if (code != 0) {
      throw new IOException("javac exit=" + code + "\n" + output);
    }
    return outDir;
  }

  private static final class ProcResult {
    public final int exitCode;
    public final String output;

    public ProcResult(int exitCode, String output) {
      this.exitCode = exitCode;
      this.output = output;
    }
  }

  private static ProcResult runContacts(Path classesDir, Path repoPath, String stdin, Duration timeout)
      throws IOException, InterruptedException {
    ProcessBuilder pb = new ProcessBuilder("java", "-cp", classesDir.toString(), "Contacts");
    pb.directory(repoPath.toFile());
    pb.redirectErrorStream(true);
    Process p = pb.start();

    try (OutputStream os = p.getOutputStream()) {
      os.write(stdin.getBytes(StandardCharsets.UTF_8));
      os.flush();
    }

    boolean finished = p.waitFor(timeout.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
    if (!finished) {
      p.destroyForcibly();
      return new ProcResult(124, "timeout");
    }
    String output = readAll(p.getInputStream());
    return new ProcResult(p.exitValue(), output);
  }

  private static String readAll(InputStream in) throws IOException {
    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    int n;
    while ((n = in.read(buf)) >= 0) {
      baos.write(buf, 0, n);
    }
    return baos.toString(StandardCharsets.UTF_8);
  }

  public static void main(String[] args) {
    if (args.length != 1) {
      System.err.println("Usage: RunTests <repo_path>");
      System.exit(2);
    }
    Path repo = Path.of(args[0]);
    RunResult res = runForRepo(repo);
    System.out.print(res.output);
    System.exit(res.exitCode);
  }
}

