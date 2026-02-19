package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Report structures following the standard schema
type Environment struct {
	GoVersion string `json:"go_version"`
	Platform  string `json:"platform"`
}

type TestResult struct {
	Passed     bool   `json:"passed"`
	ReturnCode int    `json:"return_code"`
	Output     string `json:"output"`
}

type RepoResult struct {
	Tests   TestResult         `json:"tests"`
	Metrics map[string]float64 `json:"metrics"`
}

type Comparison struct {
	PassedGate          bool   `json:"passed_gate"`
	ImprovementSummary string `json:"improvement_summary"`
}

type EvaluationReport struct {
	RunID           string      `json:"run_id"`
	StartedAt       string      `json:"started_at"`
	FinishedAt      string      `json:"finished_at"`
	DurationSeconds float64     `json:"duration_seconds"`
	Environment     Environment `json:"environment"`
	Before          RepoResult  `json:"before"`
	After           RepoResult  `json:"after"`
	Comparison      Comparison  `json:"comparison"`
	Success         bool        `json:"success"`
	Error           *string     `json:"error"`
}

func getEnvironmentInfo() Environment {
	return Environment{
		GoVersion: runtime.Version(),
		Platform:  runtime.GOOS + "-" + runtime.GOARCH,
	}
}

func runTests(repoPath string) TestResult {
	// Determine test path based on repository
	var cmd *exec.Cmd
	
	// Check if this is repository_after (which has tests in root)
	if strings.Contains(repoPath, "repository_after") {
		// For repository_after, test the main package
		cmd = exec.Command("go", "test", ".", "-v")
	} else {
		// For repository_before, test the tests subdirectory
		cmd = exec.Command("go", "test", "./tests/...", "-v")
	}
	
	cmd.Dir = repoPath
	
	output, err := cmd.CombinedOutput()
	outputStr := string(output)
	
	// Truncate output if too long
	if len(outputStr) > 8000 {
		outputStr = outputStr[:8000] + "... (truncated)"
	}
	
	returnCode := 0
	passed := true
	
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			returnCode = exitError.ExitCode()
		} else {
			returnCode = 1
		}
		passed = false
	}
	
	return TestResult{
		Passed:     passed,
		ReturnCode: returnCode,
		Output:     outputStr,
	}
}

func runMetrics(repoPath string) map[string]float64 {
	metrics := make(map[string]float64)
	
	// Basic code quality metrics
	metrics["lines_of_code"] = countLinesOfCode(repoPath)
	metrics["go_files_count"] = countGoFiles(repoPath)
	
	// Compilation time metric
	start := time.Now()
	cmd := exec.Command("go", "build", "./...")
	cmd.Dir = repoPath
	err := cmd.Run()
	buildTime := time.Since(start).Seconds() * 1000 // Convert to milliseconds
	
	if err != nil {
		metrics["build_success"] = 0
		metrics["build_time_ms"] = -1
	} else {
		metrics["build_success"] = 1
		metrics["build_time_ms"] = buildTime
	}
	
	return metrics
}

func countLinesOfCode(repoPath string) float64 {
	var totalLines float64
	
	err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if strings.HasSuffix(path, ".go") && !strings.Contains(path, "vendor/") {
			content, err := os.ReadFile(path)
			if err != nil {
				return nil
			}
			
			lines := strings.Split(string(content), "\n")
			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if trimmed != "" && !strings.HasPrefix(trimmed, "//") {
					totalLines++
				}
			}
		}
		
		return nil
	})
	
	if err != nil {
		return 0
	}
	
	return totalLines
}

func countGoFiles(repoPath string) float64 {
	var count float64
	
	err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if strings.HasSuffix(path, ".go") && !strings.Contains(path, "vendor/") {
			count++
		}
		
		return nil
	})
	
	if err != nil {
		return 0
	}
	
	return count
}

func evaluate(repoName string) RepoResult {
	// Use absolute path from /app directory
	repoPath := filepath.Join("/app", repoName)
	
	// Check if repository exists
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return RepoResult{
			Tests: TestResult{
				Passed:     false,
				ReturnCode: 1,
				Output:     fmt.Sprintf("Repository not found at: %s", repoPath),
			},
			Metrics: make(map[string]float64),
		}
	}
	
	tests := runTests(repoPath)
	metrics := runMetrics(repoPath)
	
	return RepoResult{
		Tests:   tests,
		Metrics: metrics,
	}
}

func runEvaluation() EvaluationReport {
	runID := uuid.New().String()
	start := time.Now()
	
	before := evaluate("repository_before")
	after := evaluate("repository_after")
	
	// Determine if the gate passed
	passedGate := after.Tests.Passed
	
	// Generate improvement summary
	improvementSummary := generateImprovementSummary(before, after)
	
	comparison := Comparison{
		PassedGate:          passedGate,
		ImprovementSummary: improvementSummary,
	}
	
	end := time.Now()
	duration := end.Sub(start).Seconds()
	
	return EvaluationReport{
		RunID:           runID,
		StartedAt:       start.UTC().Format("2006-01-02T15:04:05Z"),
		FinishedAt:      end.UTC().Format("2006-01-02T15:04:05Z"),
		DurationSeconds: duration,
		Environment:     getEnvironmentInfo(),
		Before:          before,
		After:           after,
		Comparison:      comparison,
		Success:         passedGate,
		Error:           nil,
	}
}

func generateImprovementSummary(before, after RepoResult) string {
	if !before.Tests.Passed && after.Tests.Passed {
		return "De-obfuscation successful: tests now pass after code cleanup"
	} else if before.Tests.Passed && after.Tests.Passed {
		return "Code successfully de-obfuscated while maintaining functionality"
	} else if !before.Tests.Passed && !after.Tests.Passed {
		return "Both versions have test failures"
	} else {
		return "De-obfuscation introduced test failures"
	}
}

func main() {
	// Create reports directory
	reportsDir := "evaluation/reports"
	err := os.MkdirAll(reportsDir, 0755)
	if err != nil {
		fmt.Printf("Error creating reports directory: %v\n", err)
		os.Exit(1)
	}
	
	// Run evaluation
	report := runEvaluation()
	
	// Handle any errors that occurred during evaluation
	if report.Error != nil {
		fmt.Printf("Evaluation error: %s\n", *report.Error)
	}
	
	// Write report to JSON
	reportJSON, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling report: %v\n", err)
		os.Exit(1)
	}
	
	// Write to latest.json
	latestPath := filepath.Join(reportsDir, "latest.json")
	err = os.WriteFile(latestPath, reportJSON, 0644)
	if err != nil {
		fmt.Printf("Error writing report: %v\n", err)
		os.Exit(1)
	}
	
	// Also write to timestamped file
	timestamp := time.Now().Format("20060102_150405")
	timestampedPath := filepath.Join(reportsDir, fmt.Sprintf("report_%s.json", timestamp))
	err = os.WriteFile(timestampedPath, reportJSON, 0644)
	if err != nil {
		fmt.Printf("Error writing timestamped report: %v\n", err)
		// Don't exit on this error, it's not critical
	}
	
	// Write report.json to root level for CI/CD pipeline
	rootReportPath := "../report.json"
	err = os.WriteFile(rootReportPath, reportJSON, 0644)
	if err != nil {
		fmt.Printf("Error writing root report.json: %v\n", err)
		// Don't exit on this error, but warn about it
	} else {
		fmt.Printf("Report written to %s for CI/CD pipeline\n", rootReportPath)
	}
	
	fmt.Printf("Report written to %s\n", latestPath)
	
	// Print summary
	fmt.Printf("Evaluation Summary:\n")
	fmt.Printf("  Before tests passed: %t\n", report.Before.Tests.Passed)
	fmt.Printf("  After tests passed: %t\n", report.After.Tests.Passed)
	fmt.Printf("  Overall success: %t\n", report.Success)
	fmt.Printf("  %s\n", report.Comparison.ImprovementSummary)
	
	// Exit with appropriate code
	if report.Success {
		os.Exit(0)
	} else {
		os.Exit(1)
	}
}