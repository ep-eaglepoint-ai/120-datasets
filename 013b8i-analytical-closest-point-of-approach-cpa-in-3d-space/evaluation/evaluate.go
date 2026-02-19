package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

const taskTitle = "013B8I - Analytical Closest Point of Approach (CPA) in 3D Space"

type TestResult struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	ID     string `json:"id"`
}

type TestResults struct {
	Passed  int          `json:"passed"`
	Failed  int          `json:"failed"`
	Errors  int          `json:"errors"`
	Skipped int          `json:"skipped"`
	Total   int          `json:"total"`
	Status  string       `json:"status"`
	Tests   []TestResult `json:"tests"`
}

type Report struct {
	RunID            string      `json:"run_id"`
	TaskTitle        string      `json:"task_title"`
	StartTime        string      `json:"start_time"`
	EndTime          string      `json:"end_time"`
	DurationSeconds  float64     `json:"duration_seconds"`
	TestResults      TestResults `json:"test_results"`
	OverallStatus    string      `json:"overall_status"`
}

func runCommand(name string, args []string, dir string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return string(output), err
}

func parseGoTestOutput(output string) TestResults {
	results := TestResults{
		Tests: make([]TestResult, 0),
	}

	lines := strings.Split(output, "\n")
	testIDCounter := 1

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Match test results: "--- PASS: TestName" or "--- FAIL: TestName"
		if strings.HasPrefix(line, "--- PASS:") {
			testName := strings.TrimSpace(strings.TrimPrefix(line, "--- PASS:"))
			// Remove timing info
			if idx := strings.Index(testName, " ("); idx != -1 {
				testName = testName[:idx]
			}
			results.Tests = append(results.Tests, TestResult{
				Name:   testName,
				Status: "passed",
				ID:     fmt.Sprintf("test_%d", testIDCounter),
			})
			results.Passed++
			testIDCounter++
		} else if strings.HasPrefix(line, "--- FAIL:") {
			testName := strings.TrimSpace(strings.TrimPrefix(line, "--- FAIL:"))
			if idx := strings.Index(testName, " ("); idx != -1 {
				testName = testName[:idx]
			}
			results.Tests = append(results.Tests, TestResult{
				Name:   testName,
				Status: "failed",
				ID:     fmt.Sprintf("test_%d", testIDCounter),
			})
			results.Failed++
			testIDCounter++
		}
	}

	// Parse summary line: "PASS" or "FAIL"
	if strings.Contains(output, "PASS") && !strings.Contains(output, "FAIL") {
		results.Status = "PASSED"
	} else if strings.Contains(output, "FAIL") {
		results.Status = "FAILED"
	}

	// Try to extract test counts from summary
	re := regexp.MustCompile(`ok\s+\S+\s+([\d.]+)s`)
	if re.MatchString(output) {
		results.Status = "PASSED"
	}

	results.Total = results.Passed + results.Failed + results.Errors + results.Skipped

	return results
}

func main() {
	runID := uuid.New().String()
	startTime := time.Now()

	fmt.Printf("Run ID: %s\n", runID)
	fmt.Printf("Started at: %s\n\n", startTime.Format(time.RFC3339))

	fmt.Println(strings.Repeat("=", 60))
	fmt.Printf("%s EVALUATION\n", taskTitle)
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println()

	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("RUNNING TESTS (REPOSITORY_AFTER)")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("Environment: repository_after")
	fmt.Println("Tests directory: /app/tests")
	fmt.Println()

	// Run tests
	output, err := runCommand("go", []string{"test", "-v"}, "/app/tests")
	fmt.Print(output)

	testResults := parseGoTestOutput(output)

	fmt.Println()
	fmt.Printf("Results: %d passed, %d failed, %d errors, %d skipped (total: %d)\n",
		testResults.Passed, testResults.Failed, testResults.Errors, testResults.Skipped, testResults.Total)

	for _, test := range testResults.Tests {
		symbol := "✓"
		statusText := "PASS"
		if test.Status == "failed" {
			symbol = "✗"
			statusText = "FAIL"
		}
		fmt.Printf("  [%s %s] %s\n", symbol, statusText, test.Name)
	}

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("EVALUATION SUMMARY")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println()

	overallStatus := "PASSED"
	if testResults.Failed > 0 || testResults.Errors > 0 || err != nil {
		overallStatus = "FAILED"
	}

	fmt.Println("Implementation (repository_after):")
	fmt.Printf("  Overall: %s\n", overallStatus)
	fmt.Printf("  Tests: %d/%d passed\n", testResults.Passed, testResults.Total)
	fmt.Println()

	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("EXPECTED BEHAVIOR CHECK")
	fmt.Println(strings.Repeat("=", 60))

	if overallStatus == "PASSED" {
		fmt.Println("[✓ OK] All tests passed (expected)")
	} else {
		fmt.Println("[✗ FAIL] Some tests failed (unexpected)")
	}

	endTime := time.Now()
	duration := endTime.Sub(startTime).Seconds()

	// Create report
	report := Report{
		RunID:           runID,
		TaskTitle:       taskTitle,
		StartTime:       startTime.Format(time.RFC3339),
		EndTime:         endTime.Format(time.RFC3339),
		DurationSeconds: duration,
		TestResults:     testResults,
		OverallStatus:   overallStatus,
	}

	// Save report
	dateStr := startTime.Format("2006-01-02")
	timeStr := startTime.Format("15-04-05")
	reportDir := filepath.Join("/app/evaluation/reports", dateStr, timeStr)

	err = os.MkdirAll(reportDir, 0755)
	if err != nil {
		fmt.Printf("Error creating report directory: %v\n", err)
	} else {
		reportPath := filepath.Join(reportDir, "report.json")
		reportJSON, _ := json.MarshalIndent(report, "", "  ")
		err = os.WriteFile(reportPath, reportJSON, 0644)
		if err != nil {
			fmt.Printf("Error writing report: %v\n", err)
		} else {
			fmt.Println()
			fmt.Println("Report saved to:")
			fmt.Println(reportPath)
		}
	}

	fmt.Println()
	fmt.Println(strings.Repeat("=", 60))
	fmt.Println("EVALUATION COMPLETE")
	fmt.Println(strings.Repeat("=", 60))
	fmt.Printf("Run ID: %s\n", runID)
	fmt.Printf("Duration: %.2fs\n", duration)
	if overallStatus == "PASSED" {
		fmt.Println("Success: YES")
	} else {
		fmt.Println("Success: NO")
	}

	// Exit with code 0 always (as per requirements)
	os.Exit(0)
}
