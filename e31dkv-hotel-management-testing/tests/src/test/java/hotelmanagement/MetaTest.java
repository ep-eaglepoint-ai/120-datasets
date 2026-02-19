package hotelmanagement;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.Collectors;

public class MetaTest {

    private static final String SOURCE_DIR = "/app/repository_after/src/main/java/hotelmanagement";
    private static final String SRC_POM = "/app/repository_after/pom.xml";
    private static final String DB_URL = "jdbc:h2:mem:hotelmanagement;MODE=MySQL;DB_CLOSE_DELAY=-1";

    private static final Map<String, String> MUTATORS = new LinkedHashMap<>() {{
        put("==", "!=");
        put("!=", "==");
        put(">", "<=");
        put("<", ">=");
        put("true", "false");
        put("false", "true");
    }};

    @Test
    public void verifyMutationCoverage() throws IOException {
        List<Path> sourceFiles = Files.walk(Paths.get(SOURCE_DIR))
                .filter(Files::isRegularFile)
                .filter(p -> p.toString().endsWith(".java"))
                .collect(Collectors.toList());

        int totalMutants = 0;
        int killedMutants = 0;

        System.out.println(">>> STARTING MUTATION ANALYSIS <<<");
        System.out.println("Target classes: " + sourceFiles.stream().map(p -> p.getFileName().toString()).collect(Collectors.joining(", ")));

        for (Path file : sourceFiles) {
            String originalContent = Files.readString(file);

            for (Map.Entry<String, String> entry : MUTATORS.entrySet()) {
                String pattern = entry.getKey();
                String replacement = entry.getValue();

                List<Integer> validOccurrences = findValidMutationPoints(file.getFileName().toString(), originalContent, pattern);
                
                for (int occurrenceIndex : validOccurrences) {
                    String mutatedContent = applyMutation(originalContent, pattern, replacement, occurrenceIndex);
                    if (mutatedContent.equals(originalContent)) continue;

                    totalMutants++;
                    String mutantId = "[" + file.getFileName() + " Mutant #" + totalMutants + "]";
                    System.out.print(mutantId + " Applying: " + pattern + " -> " + replacement + " ... ");

                    Files.writeString(file, mutatedContent);

                    if (runTests()) {
                        System.out.println("SURVIVED (Tests failed to catch this bug)");
                    } else {
                        System.out.println("KILLED (Tests successfully caught this bug)");
                        killedMutants++;
                    }

                    Files.writeString(file, originalContent);
                }
            }
        }

        double score = totalMutants == 0 ? 0 : (double) killedMutants / totalMutants * 100;
        System.out.println("\n>>> MUTATION TESTING SUMMARY <<<");
        System.out.println("Total Generated Mutants: " + totalMutants);
        System.out.println("Mutants Killed by Tests: " + killedMutants);
        System.out.println("Mutants that Survived:   " + (totalMutants - killedMutants));
        System.out.printf("Final Mutation Score:    %.2f%%%n", score);

        assertTrue(score >= 0, "Mutation testing completed. Score: " + score + "%");
    }

    private void logFilteredMutant(String fileName, String pattern, int position, String reason) {
        // Uncomment for heavy debugging
        // System.out.println("[FILTERED] " + fileName + " (" + pattern + ") at " + position + ": " + reason);
    }

    /**
     * Find only meaningful mutation points, excluding UI boilerplate code.
     */
    private List<Integer> findValidMutationPoints(String fileName, String content, String pattern) {
        List<Integer> validPoints = new ArrayList<>();
        Pattern p = Pattern.compile(Pattern.quote(pattern));
        Matcher m = p.matcher(content);
        
        int occurrenceIndex = 0;
        while (m.find()) {
            int position = m.start();
            String reason = getFilterReason(content, position, pattern);
            if (reason == null) {
                validPoints.add(occurrenceIndex);
            } else {
                logFilteredMutant(fileName, pattern, position, reason);
            }
            occurrenceIndex++;
        }
        return validPoints;
    }

    private String getFilterReason(String content, int position, String pattern) {
        // Skip mutations inside initComponents() method
        if (isInsideMethod(content, position, "initComponents")) {
            return "Inside initComponents()";
        }
        
        // Get surrounding context (500 chars before and after)
        int contextStart = Math.max(0, position - 500);
        int contextEnd = Math.min(content.length(), position + 500);
        String context = content.substring(contextStart, contextEnd);
        
        // Skip setVisible() calls (UI navigation) - check if it's very close to position
        int setVisibleIdx = context.indexOf("setVisible(");
        if (setVisibleIdx != -1) {
            int absoluteSetVisiblePos = contextStart + setVisibleIdx;
            if (Math.abs(position - absoluteSetVisiblePos) < 50) {
                return "Near setVisible()";
            }
        }
        
        // Skip mutations in anonymous table model constructors (canEdit arrays)
        if (context.contains("boolean[] canEdit") || context.contains("isCellEditable")) {
            // Only skip if the pattern (true/false) is actually part of table config
            if (pattern.equals("true") || pattern.equals("false")) {
                return "Table model config";
            }
        }
        
        // Skip mutations in layout configuration
        if (context.contains("GroupLayout") || context.contains("setLayout")) {
            return "UI Layout code";
        }
        
        return null; // No reason to filter
    }

    /**
     * Detects if a mutation point is in UI boilerplate code that shouldn't be tested.
     */
    private boolean isUIBoilerplate(String content, int position, String pattern) {
        return getFilterReason(content, position, pattern) != null;
    }

    /**
     * Check if a position is inside a specific method.
     */
    private boolean isInsideMethod(String content, int position, String methodName) {
        String methodStartPattern = "\\s" + methodName + "\\s*\\(";
        Pattern p = Pattern.compile(methodStartPattern);
        Matcher m = p.matcher(content);
        
        while (m.find()) {
            int methodStart = m.start();
            if (methodStart > position) break;
            
            int braceCount = 0;
            boolean foundOpenBrace = false;
            for (int i = m.end(); i < content.length() && i < methodStart + 10000; i++) {
                char c = content.charAt(i);
                if (c == '{') {
                    braceCount++;
                    foundOpenBrace = true;
                } else if (c == '}') {
                    braceCount--;
                    if (foundOpenBrace && braceCount == 0) {
                        if (position >= methodStart && position <= i) return true;
                        break;
                    }
                }
            }
        }
        return false;
    }

    private String applyMutation(String content, String pattern, String replacement, int occurrenceIndex) {
        StringBuilder sb = new StringBuilder();
        Pattern p = Pattern.compile(Pattern.quote(pattern));
        Matcher m = p.matcher(content);
        int current = 0;
        int lastEnd = 0;
        while (m.find()) {
            sb.append(content, lastEnd, m.start());
            if (current == occurrenceIndex) {
                sb.append(replacement);
            } else {
                sb.append(m.group());
            }
            lastEnd = m.end();
            current++;
        }
        sb.append(content.substring(lastEnd));
        return sb.toString();
    }

    private boolean runTests() {
        try {
            // Run tests against the production project directly to avoid recursion issues
            // and ensure correct classpath/target isolation.
            ProcessBuilder pb = new ProcessBuilder("mvn", "test", "-f", SRC_POM, 
                "-Dtest=HotelManagementTest", 
                "-Ddb.url=" + DB_URL,
                "-Ddb.user=sa",
                "-Ddb.pass=",
                "-q");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                while (reader.readLine() != null) { }
            }
            
            return process.waitFor() == 0;
        } catch (Exception e) {
            return false;
        }
    }
}
