package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

func runGoTest(testsDir string, label string) TestRunResult {
	fmt.Printf("\n%s\n", strings.Repeat("=", 60))
	fmt.Printf("RUNNING TESTS: %s\n", strings.ToUpper(label))
	fmt.Printf("%s\n", strings.Repeat("=", 60))
	fmt.Printf("Tests directory: %s\n", testsDir)

	cmd := exec.Command("go", "test", "-v", "./tests/...")
	cmd.Dir = filepath.Dir(testsDir)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	output := stdout.String()
	tests := parseGoTestOutput(output)

	passed := 0
	failed := 0
	skipped := 0
	for _, test := range tests {
		switch test.Outcome {
		case "PASS":
			passed++
		case "FAIL":
			failed++
		case "SKIP":
			skipped++
		}
	}
	total := len(tests)

	fmt.Printf("\nResults: %d passed, %d failed, %d skipped (total: %d)\n", passed, failed, skipped, total)

	for _, test := range tests {
		statusIcon := map[string]string{
			"PASS": "✅",
			"FAIL": "❌",
			"SKIP": "⏭️",
		}[test.Outcome]
		if statusIcon == "" {
			statusIcon = "❓"
		}
		fmt.Printf("  %s %s: %s\n", statusIcon, test.NodeID, test.Outcome)
	}

	return TestRunResult{
		Success:  exitCode == 0,
		ExitCode: exitCode,
		Tests:    tests,
		Summary: TestSummary{
			Total:   total,
			Passed:  passed,
			Failed:  failed,
			Skipped: skipped,
		},
		Stdout: output,
		Stderr: stderr.String(),
	}
}

func parseGoTestOutput(output string) []TestResult {
	var tests []TestResult
	lines := strings.Split(output, "\n")

	re := regexp.MustCompile(`--- (PASS|FAIL|SKIP): ([^(]+) \(`)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if matches := re.FindStringSubmatch(line); len(matches) == 3 {
			outcome := matches[1]
			nodeID := strings.TrimSpace(matches[2])
			name := nodeID
			if strings.Contains(nodeID, "/") {
				parts := strings.Split(nodeID, "/")
				name = parts[len(parts)-1]
			}

			tests = append(tests, TestResult{
				NodeID:  nodeID,
				Name:    name,
				Outcome: outcome,
			})
		}
	}

	return tests
}
