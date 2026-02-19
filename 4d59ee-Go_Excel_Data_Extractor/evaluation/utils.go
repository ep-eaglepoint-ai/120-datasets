package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func generateRunID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func getGitInfo() (string, string) {
	gitCommit := "unknown"
	gitBranch := "unknown"

	if out, err := exec.Command("git", "rev-parse", "HEAD").Output(); err == nil {
		gitCommit = strings.TrimSpace(string(out))[:8]
	}

	if out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output(); err == nil {
		gitBranch = strings.TrimSpace(string(out))
	}

	return gitCommit, gitBranch
}

func getEnvironmentInfo() Environment {
	gitCommit, gitBranch := getGitInfo()

	hostname := "unknown"
	if h, err := os.Hostname(); err == nil {
		hostname = h
	}

	return Environment{
		GoVersion:    runtime.Version(),
		Platform:     runtime.GOOS + "/" + runtime.GOARCH,
		OS:           runtime.GOOS,
		OSRelease:    "unknown", // Go doesn't provide this easily
		Architecture: runtime.GOARCH,
		Hostname:     hostname,
		GitCommit:    gitCommit,
		GitBranch:    gitBranch,
	}
}

func generateOutputPath() string {
	now := time.Now()
	dateStr := now.Format("2006-01-02")
	timeStr := now.Format("15-04-05")

	projectRoot, _ := os.Getwd()
	outputDir := filepath.Join(projectRoot, "evaluation", "reports", dateStr, timeStr)
	os.MkdirAll(outputDir, 0755)

	return filepath.Join(outputDir, "report.json")
}
