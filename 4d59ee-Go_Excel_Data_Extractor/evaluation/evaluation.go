// Evaluation runner for Go Excel Data Extractor.
//
// This evaluation script:
// - Runs go test on the tests/ folder
// - Collects individual test results with pass/fail status
// - Generates structured reports with environment metadata
//
// Run with:
//     go run evaluation/evaluation.go [options]

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func runEvaluation() *Results {
	fmt.Printf("\n%s\n", strings.Repeat("=", 60))
	fmt.Println("GO EXCEL DATA EXTRACTOR EVALUATION")
	fmt.Printf("%s\n", strings.Repeat("=", 60))

	projectRoot, _ := os.Getwd()
	testsDir := filepath.Join(projectRoot, "tests")

	// No before implementation, so set to empty
	beforeResults := TestRunResult{
		Success:  true,
		ExitCode: 0,
		Tests:    []TestResult{},
		Summary: TestSummary{
			Total:   0,
			Passed:  0,
			Failed:  0,
			Skipped: 0,
		},
		Stdout: "",
		Stderr: "",
	}

	// Run tests with AFTER implementation
	afterResults := runGoTest(testsDir, "after (repository_after)")

	comparison := Comparison{
		BeforeTestsPassed: beforeResults.Success,
		AfterTestsPassed:  afterResults.Success,
		BeforeTotal:       beforeResults.Summary.Total,
		BeforePassed:      beforeResults.Summary.Passed,
		BeforeFailed:      beforeResults.Summary.Failed,
		AfterTotal:        afterResults.Summary.Total,
		AfterPassed:       afterResults.Summary.Passed,
		AfterFailed:       afterResults.Summary.Failed,
	}

	fmt.Printf("\n%s\n", strings.Repeat("=", 60))
	fmt.Println("EVALUATION SUMMARY")
	fmt.Printf("%s\n", strings.Repeat("=", 60))

	fmt.Printf("\nBefore Implementation (repository_before):")
	fmt.Printf("  Overall: %s\n", map[bool]string{true: "✅ PASSED", false: "❌ FAILED"}[beforeResults.Success])
	fmt.Printf("  Tests: %d/%d passed\n", comparison.BeforePassed, comparison.BeforeTotal)

	fmt.Printf("\nAfter Implementation (repository_after):")
	fmt.Printf("  Overall: %s\n", map[bool]string{true: "✅ PASSED", false: "❌ FAILED"}[afterResults.Success])
	fmt.Printf("  Tests: %d/%d passed\n", comparison.AfterPassed, comparison.AfterTotal)

	fmt.Printf("\n%s\n", strings.Repeat("=", 60))
	fmt.Println("EXPECTED BEHAVIOR CHECK")
	fmt.Printf("%s\n", strings.Repeat("=", 60))

	if afterResults.Success {
		fmt.Println("✅ After implementation: All tests passed (expected)")
	} else {
		fmt.Println("❌ After implementation: Some tests failed (unexpected - should pass all)")
	}

	return &Results{
		Before:     beforeResults,
		After:      afterResults,
		Comparison: comparison,
	}
}

func main() {
	runID := generateRunID()
	startedAt := time.Now()

	fmt.Printf("Run ID: %s\n", runID)
	fmt.Printf("Started at: %s\n", startedAt.Format(time.RFC3339))

	var results *Results
	var success bool
	var errorMsg *string

	defer func() {
		finishedAt := time.Now()
		duration := finishedAt.Sub(startedAt).Seconds()

		report := Report{
			RunID:           runID,
			StartedAt:       startedAt.Format(time.RFC3339),
			FinishedAt:      finishedAt.Format(time.RFC3339),
			DurationSeconds: duration,
			Success:         success,
			Error:           errorMsg,
			Environment:     getEnvironmentInfo(),
			Results:         results,
		}

		outputPath := generateOutputPath()
		if data, err := json.MarshalIndent(report, "", "  "); err == nil {
			os.WriteFile(outputPath, data, 0644)
			fmt.Printf("\n✅ Report saved to: %s\n", outputPath)
		} else {
			fmt.Printf("\n❌ Failed to save report: %v\n", err)
		}

		fmt.Printf("\n%s\n", strings.Repeat("=", 60))
		fmt.Println("EVALUATION COMPLETE")
		fmt.Printf("%s\n", strings.Repeat("=", 60))
		fmt.Printf("Run ID: %s\n", runID)
		fmt.Printf("Duration: %.2fs\n", duration)
		fmt.Printf("Success: %s\n", map[bool]string{true: "✅ YES", false: "❌ NO"}[success])

		os.Exit(map[bool]int{true: 0, false: 1}[success])
	}()

	results = runEvaluation()
	success = results.After.Success
	if !success {
		msg := "After implementation tests failed"
		errorMsg = &msg
	}
}
