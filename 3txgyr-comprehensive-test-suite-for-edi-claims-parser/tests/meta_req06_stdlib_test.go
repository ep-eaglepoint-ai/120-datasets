package tests

import (
	"strings"
	"testing"
)

func TestMeta_REQ6_NoDeprecatedAPIs(t *testing.T) {
	content := readAllTestFiles(t)

	if strings.Contains(content, `"io/ioutil"`) {
		t.Error("REQ6: Must not use deprecated ioutil package")
	}

	if strings.Contains(content, "ioutil.ReadFile") {
		t.Error("REQ6: Use os.ReadFile instead of ioutil.ReadFile")
	}
}

func TestMeta_REQ6_StandardLibraryOnly(t *testing.T) {
	content := readAllTestFiles(t)

	externalFrameworks := []string{
		`"github.com/stretchr/testify`,
		`"github.com/onsi/ginkgo`,
		`"github.com/onsi/gomega`,
	}

	for _, fw := range externalFrameworks {
		if strings.Contains(content, fw) {
			t.Errorf("REQ6: Must not use external test framework: %s", fw)
		}
	}
}

func TestMeta_REQ6_StandardTestingPackage(t *testing.T) {
	content := readAllTestFiles(t)

	if !strings.Contains(content, `"testing"`) {
		t.Error("REQ6: Must use standard testing package")
	}

	standardPatterns := []string{
		`func Test_`,
		`t.Error`,
		`t.Run`,
	}

	for _, p := range standardPatterns {
		if !strings.Contains(content, p) {
			t.Errorf("REQ6: Missing standard testing pattern: %s", p)
		}
	}
}
