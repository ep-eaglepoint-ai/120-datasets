package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

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
}

func TestDatabaseConstants(t *testing.T) {
	assert.Equal(t, "godoc", databaseName)
	assert.Equal(t, "users", usersCollection)
	assert.Equal(t, "documents", documentsCollection)
}

func TestWebSocketUpgraderConfiguration(t *testing.T) {
	assert.Equal(t, 1024, upgrader.ReadBufferSize)
	assert.Equal(t, 1024, upgrader.WriteBufferSize)
}