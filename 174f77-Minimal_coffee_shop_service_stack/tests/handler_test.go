package tests

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"coffee-shop/repository_after/health"
	"coffee-shop/repository_after/storage"
)

type MockPostgres struct{}

func (m *MockPostgres) Ping() error {
	return nil
}

func TestHealthEndpoint(t *testing.T) {
	// Get Redis address from environment
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}
	redisAddr := fmt.Sprintf("%s:%s", redisHost, redisPort)

	// Connect to Redis
	redis, err := storage.NewRedisClient(redisAddr)
	if err != nil {
		t.Fatalf("Failed to connect to redis: %v", err)
	}

	// Create a minimal mock DB
	db, _ := sql.Open("postgres", "")
	defer db.Close()

	// Create handler
	handler := health.Handler(db, redis)

	// Create test request
	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()

	// Execute request
	handler(rec, req)

	// Check status code (can be 200 or 503 depending on postgres mock)
	if rec.Code != http.StatusOK && rec.Code != http.StatusServiceUnavailable {
		t.Errorf("Expected status 200 or 503, got %d", rec.Code)
	}

	// Parse response
	var response map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Verify response structure
	if _, ok := response["status"]; !ok {
		t.Error("Response missing 'status' field")
	}
	if _, ok := response["postgres"]; !ok {
		t.Error("Response missing 'postgres' field")
	}
	if _, ok := response["redis"]; !ok {
		t.Error("Response missing 'redis' field")
	}

	// Redis should be up (we connected successfully)
	if response["redis"] != "up" {
		t.Errorf("Expected redis to be 'up', got '%s'", response["redis"])
	}

	t.Logf("Health check response: %+v", response)
}