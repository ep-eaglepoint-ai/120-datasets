package collaborate

import (
	"fmt"
	"sync"
)

// MockLogger is a goroutine-safe logger that captures Error calls for test verification.
// SOC 2 / compliance: used to assert exact log message content, field values, and call order.
type MockLogger struct {
	mu     sync.Mutex
	Calls  []MockLogEntry
	Errors []string
}

type MockLogEntry struct {
	Msg           string
	KeysAndValues []interface{}
}

func (m *MockLogger) Error(msg string, keysAndValues ...interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Calls = append(m.Calls, MockLogEntry{Msg: msg, KeysAndValues: keysAndValues})
	m.Errors = append(m.Errors, fmt.Sprintf("%s %v", msg, keysAndValues))
}

func (m *MockLogger) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Calls = m.Calls[:0]
	m.Errors = m.Errors[:0]
}

func (m *MockLogger) LastError() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.Errors) == 0 {
		return ""
	}
	return m.Errors[len(m.Errors)-1]
}
