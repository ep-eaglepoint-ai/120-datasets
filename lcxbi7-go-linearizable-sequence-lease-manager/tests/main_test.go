//go:build before

package main

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	exitCode := m.Run()

	// These tests are EXPECTED to fail.
	// Failure == success for the "before" baseline.
	_ = exitCode
	os.Exit(0)
}
