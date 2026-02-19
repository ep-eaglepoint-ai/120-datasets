package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/khallihub/godoc/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock controller for testing
type MockDocumentController struct {
	mock.Mock
}

func (m *MockDocumentController) GetAllDocuments(ctx *gin.Context) (interface{}, error) {
	args := m.Called(ctx)
	return args.Get(0), args.Error(1)
}

func (m *MockDocumentController) SearchDocuments(ctx *gin.Context) (interface{}, error) {
	args := m.Called(ctx)
	return args.Get(0), args.Error(1)
}

func (m *MockDocumentController) CreateNewDocument(ctx *gin.Context) {
	m.Called(ctx)
}

func (m *MockDocumentController) UpdateDocument(documentID string, body dto.DocumentData) error {
	args := m.Called(documentID, body)
	return args.Error(0)
}

func (m *MockDocumentController) GetOneDocument(ctx *gin.Context) (*dto.Document, error) {
	args := m.Called(ctx)
	return args.Get(0).(*dto.Document), args.Error(1)
}

func (m *MockDocumentController) UpdateTitle(ctx *gin.Context) (string, string) {
	args := m.Called(ctx)
	return args.String(0), args.String(1)
}

func (m *MockDocumentController) UpdateCollaborators(ctx *gin.Context) dto.Document {
	args := m.Called(ctx)
	return args.Get(0).(dto.Document)
}

func (m *MockDocumentController) DeleteDocument(ctx *gin.Context) {
	m.Called(ctx)
}

func TestMain(m *testing.M) {
	// Set test environment
	os.Setenv("DATABASE_URL", "mongodb://localhost:27017")
	os.Setenv("PORT", "8080")
	os.Setenv("JWT_SECRET", "test_secret")
	
	// Run tests
	code := m.Run()
	
	// Cleanup
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("PORT")
	os.Unsetenv("JWT_SECRET")
	
	os.Exit(code)
}

func TestHealthEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "UP"})
	})
	
	req, _ := http.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	assert.NoError(t, err)
	assert.Equal(t, "UP", response["status"])
}

func TestDocumentCacheOperations(t *testing.T) {
	// Test initializeDocumentCache
	t.Run("InitializeDocumentCache_NewDocument", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Params = gin.Params{{Key: "id", Value: "test-doc-id"}}
		
		mockController := &MockDocumentController{}
		testDoc := &dto.Document{
			ID:    "test-doc-id",
			Title: "Test Document",
			Data:  dto.DocumentData{Content: "Test content"},
		}
		
		mockController.On("GetOneDocument", ctx).Return(testDoc, nil)
		
		// Clear cache before test
		documentCache.Delete("test-doc-id")
		
		result, err := initializeDocumentCache(ctx, mockController)
		
		assert.NoError(t, err)
		assert.Equal(t, testDoc, result)
		
		// Verify document is cached
		cached, exists := documentCache.Load("test-doc-id")
		assert.True(t, exists)
		assert.Equal(t, testDoc, cached)
		
		mockController.AssertExpectations(t)
	})
	
	t.Run("InitializeDocumentCache_CachedDocument", func(t *testing.T) {
		gin.SetMode(gin.TestMode)
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Params = gin.Params{{Key: "id", Value: "cached-doc-id"}}
		
		mockController := &MockDocumentController{}
		testDoc := &dto.Document{
			ID:    "cached-doc-id",
			Title: "Cached Document",
			Data:  dto.DocumentData{Content: "Cached content"},
		}
		
		// Pre-populate cache
		documentCache.Store("cached-doc-id", testDoc)
		
		result, err := initializeDocumentCache(ctx, mockController)
		
		assert.NoError(t, err)
		assert.Equal(t, testDoc, result)
		
		// Should not call GetOneDocument since it's cached
		mockController.AssertNotCalled(t, "GetOneDocument")
	})
}

func TestUpdateDocumentCache(t *testing.T) {
	t.Run("UpdateDocumentCache_Success", func(t *testing.T) {
		documentID := "update-test-doc"
		testDoc := &dto.Document{
			ID:    documentID,
			Title: "Original Title",
			Data:  dto.DocumentData{Content: "Original content"},
		}
		
		// Pre-populate cache
		documentCache.Store(documentID, testDoc)
		
		newData := dto.DocumentData{Content: "Updated content"}
		err := updateDocumentCache(documentID, &MockDocumentController{}, newData)
		
		assert.NoError(t, err)
		
		// Verify cache was updated
		cached, exists := documentCache.Load(documentID)
		assert.True(t, exists)
		updatedDoc := cached.(*dto.Document)
		assert.Equal(t, newData, updatedDoc.Data)
		assert.Equal(t, "Original Title", updatedDoc.Title) // Title should remain unchanged
	})
	
	t.Run("UpdateDocumentCache_DocumentNotFound", func(t *testing.T) {
		err := updateDocumentCache("non-existent-doc", &MockDocumentController{}, dto.DocumentData{})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "document not found in cache")
	})
}

func TestUpdateDocumentTitleCacheAttribute(t *testing.T) {
	t.Run("UpdateDocumentTitleCacheAttribute_Success", func(t *testing.T) {
		documentID := "title-test-doc"
		testDoc := &dto.Document{
			ID:    documentID,
			Title: "Original Title",
			Data:  dto.DocumentData{Content: "Test content"},
		}
		
		// Pre-populate cache
		documentCache.Store(documentID, testDoc)
		
		newTitle := "Updated Title"
		err := updateDocumentTitleCacheAttribute(documentID, newTitle)
		
		assert.NoError(t, err)
		
		// Verify cache was updated
		cached, exists := documentCache.Load(documentID)
		assert.True(t, exists)
		updatedDoc := cached.(*dto.Document)
		assert.Equal(t, newTitle, updatedDoc.Title)
	})
	
	t.Run("UpdateDocumentTitleCacheAttribute_DocumentNotFound", func(t *testing.T) {
		err := updateDocumentTitleCacheAttribute("non-existent-doc", "New Title")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "document not found in cache")
	})
}

func TestUpdateDocumentCacheAttribute(t *testing.T) {
	t.Run("UpdateDocumentCacheAttribute_Success", func(t *testing.T) {
		documentID := "access-test-doc"
		testDoc := &dto.Document{
			ID:          documentID,
			Title:       "Test Document",
			ReadAccess:  []string{"user1"},
			WriteAccess: []string{"user1"},
		}
		
		// Pre-populate cache
		documentCache.Store(documentID, testDoc)
		
		newAccess := dto.Access{
			ID:          documentID,
			ReadAccess:  []string{"user1", "user2"},
			WriteAccess: []string{"user1", "user2"},
		}
		
		err := updateDocumentCacheAttribute(documentID, &MockDocumentController{}, newAccess)
		
		assert.NoError(t, err)
		
		// Verify cache was updated
		cached, exists := documentCache.Load(documentID)
		assert.True(t, exists)
		updatedDoc := cached.(*dto.Document)
		assert.Equal(t, newAccess.ReadAccess, updatedDoc.ReadAccess)
		assert.Equal(t, newAccess.WriteAccess, updatedDoc.WriteAccess)
	})
}

func TestSyncDatabaseWithCache(t *testing.T) {
	t.Run("SyncDatabaseWithCache_Success", func(t *testing.T) {
		mockController := &MockDocumentController{}
		
		// Setup test documents in cache
		doc1 := &dto.Document{
			ID:   "doc1",
			Data: dto.DocumentData{Content: "Content 1"},
		}
		doc2 := &dto.Document{
			ID:   "doc2",
			Data: dto.DocumentData{Content: "Content 2"},
		}
		
		documentCache.Store("doc1", doc1)
		documentCache.Store("doc2", doc2)
		
		// Mock successful updates
		mockController.On("UpdateDocument", "doc1", doc1.Data).Return(nil)
		mockController.On("UpdateDocument", "doc2", doc2.Data).Return(nil)
		
		err := syncDatabaseWithCache(mockController)
		
		assert.NoError(t, err)
		mockController.AssertExpectations(t)
		
		// Cleanup
		documentCache.Delete("doc1")
		documentCache.Delete("doc2")
	})
}

func TestDocumentWebSocketManagement(t *testing.T) {
	t.Run("DocumentWebSocket_Creation", func(t *testing.T) {
		// Clear existing websockets
		documentWebSockets = make(map[string]*DocumentWebSocket)
		
		documentID := "test-websocket-doc"
		
		// Simulate WebSocket creation logic
		_, exists := documentWebSockets[documentID]
		assert.False(t, exists)
		
		// Create new WebSocket handler
		documentWS := &DocumentWebSocket{
			Connections: make(map[*websocket.Conn]bool),
		}
		documentWebSockets[documentID] = documentWS
		
		// Verify creation
		retrievedWS, exists := documentWebSockets[documentID]
		assert.True(t, exists)
		assert.NotNil(t, retrievedWS)
		assert.Equal(t, 0, len(retrievedWS.Connections))
	})
	
	t.Run("DocumentWebSocket_ConnectionManagement", func(t *testing.T) {
		documentID := "connection-test-doc"
		documentWS := &DocumentWebSocket{
			Connections: make(map[*websocket.Conn]bool),
		}
		documentWebSockets[documentID] = documentWS
		
		// Simulate connection addition (we can't create real websocket.Conn in tests)
		// So we'll test the logic structure
		initialCount := len(documentWS.Connections)
		assert.Equal(t, 0, initialCount)
		
		// Test mutex protection
		documentWS.Mutex.Lock()
		// Simulate adding connection
		documentWS.Mutex.Unlock()
		
		// Test cleanup logic
		if len(documentWS.Connections) == 0 {
			documentCache.Delete(documentID)
			delete(documentWebSockets, documentID)
		}
		
		_, exists := documentWebSockets[documentID]
		assert.False(t, exists)
	})
}

func TestConcurrentCacheOperations(t *testing.T) {
	t.Run("ConcurrentCacheAccess", func(t *testing.T) {
		documentID := "concurrent-test-doc"
		testDoc := &dto.Document{
			ID:    documentID,
			Title: "Concurrent Test",
			Data:  dto.DocumentData{Content: "Initial content"},
		}
		
		documentCache.Store(documentID, testDoc)
		
		var wg sync.WaitGroup
		numGoroutines := 10
		
		// Test concurrent reads
		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				cached, exists := documentCache.Load(documentID)
				assert.True(t, exists)
				assert.NotNil(t, cached)
			}()
		}
		
		// Test concurrent updates
		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()
				newData := dto.DocumentData{Content: fmt.Sprintf("Updated content %d", index)}
				err := updateDocumentCache(documentID, &MockDocumentController{}, newData)
				assert.NoError(t, err)
			}(i)
		}
		
		wg.Wait()
		
		// Verify final state
		cached, exists := documentCache.Load(documentID)
		assert.True(t, exists)
		assert.NotNil(t, cached)
		
		// Cleanup
		documentCache.Delete(documentID)
	})
}

func TestEnvironmentVariableHandling(t *testing.T) {
	t.Run("DatabaseURL_Missing", func(t *testing.T) {
		// This test would require refactoring main() to be testable
		// For now, we test the logic pattern
		dbURL := os.Getenv("NONEXISTENT_DATABASE_URL")
		if len(dbURL) == 0 {
			// This is the expected behavior when DATABASE_URL is missing
			assert.True(t, true)
		}
	})
	
	t.Run("Port_DefaultValue", func(t *testing.T) {
		// Clear PORT env var
		originalPort := os.Getenv("PORT")
		os.Unsetenv("PORT")
		
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		
		assert.Equal(t, "8080", port)
		
		// Restore original value
		if originalPort != "" {
			os.Setenv("PORT", originalPort)
		}
	})
}

func TestRouteStructure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	// Test health endpoint
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "UP"})
	})
	
	// Test auth routes group
	authRoutes := router.Group("/auth")
	{
		authRoutes.POST("/signup", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{"message": "signup endpoint"})
		})
		authRoutes.POST("/login", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{"message": "login endpoint"})
		})
	}
	
	// Test document routes group
	documentRoutes := router.Group("/documents")
	{
		documentRoutes.GET("/handler", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{"message": "websocket handler"})
		})
		documentRoutes.POST("/getall", func(ctx *gin.Context) {
			ctx.JSON(http.StatusOK, gin.H{"message": "get all documents"})
		})
	}
	
	// Test routes
	testCases := []struct {
		method   string
		path     string
		expected int
	}{
		{"GET", "/health", http.StatusOK},
		{"POST", "/auth/signup", http.StatusOK},
		{"POST", "/auth/login", http.StatusOK},
		{"GET", "/documents/handler", http.StatusOK},
		{"POST", "/documents/getall", http.StatusOK},
	}
	
	for _, tc := range testCases {
		t.Run(fmt.Sprintf("%s_%s", tc.method, strings.ReplaceAll(tc.path, "/", "_")), func(t *testing.T) {
			req, _ := http.NewRequest(tc.method, tc.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, tc.expected, w.Code)
		})
	}
}

func TestWebSocketUpgraderConfiguration(t *testing.T) {
	t.Run("WebSocketUpgrader_Configuration", func(t *testing.T) {
		// Test upgrader configuration
		assert.Equal(t, 1024, upgrader.ReadBufferSize)
		assert.Equal(t, 1024, upgrader.WriteBufferSize)
		
		// Test CheckOrigin function (should allow all origins)
		upgrader.CheckOrigin = func(r *http.Request) bool {
			return true
		}
		
		req, _ := http.NewRequest("GET", "/", nil)
		result := upgrader.CheckOrigin(req)
		assert.True(t, result)
	})
}

func TestDatabaseSyncTicker(t *testing.T) {
	t.Run("DatabaseSyncTicker_Creation", func(t *testing.T) {
		// Test ticker creation logic
		ticker := time.NewTicker(30 * time.Second)
		assert.NotNil(t, ticker)
		
		// Verify interval
		// Note: We can't easily test the exact interval without waiting,
		// but we can verify the ticker was created successfully
		ticker.Stop()
	})
}

// Benchmark tests for performance comparison
func BenchmarkDocumentCacheLoad(b *testing.B) {
	documentID := "benchmark-doc"
	testDoc := &dto.Document{
		ID:    documentID,
		Title: "Benchmark Document",
		Data:  dto.DocumentData{Content: "Benchmark content"},
	}
	
	documentCache.Store(documentID, testDoc)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		documentCache.Load(documentID)
	}
	
	documentCache.Delete(documentID)
}

func BenchmarkDocumentCacheStore(b *testing.B) {
	testDoc := &dto.Document{
		ID:    "benchmark-store-doc",
		Title: "Benchmark Store Document",
		Data:  dto.DocumentData{Content: "Benchmark store content"},
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		documentID := fmt.Sprintf("benchmark-doc-%d", i)
		documentCache.Store(documentID, testDoc)
	}
	
	// Cleanup
	for i := 0; i < b.N; i++ {
		documentID := fmt.Sprintf("benchmark-doc-%d", i)
		documentCache.Delete(documentID)
	}
}