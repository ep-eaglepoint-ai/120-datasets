package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/khallihub/godoc/controller"
	"github.com/khallihub/godoc/dto"
	"github.com/khallihub/godoc/middlewares"
	"github.com/khallihub/godoc/service"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type DocumentWebSocket struct {
	Connections map[*websocket.Conn]bool
	Mutex       sync.Mutex
}

var documentWebSockets = make(map[string]*DocumentWebSocket)
var documentCache sync.Map

// Database and collection names
var databaseName, usersCollection, documentsCollection = "godoc", "users", "documents"

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Error loading .env file:", err.Error())
		return
	}

	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if len(dbURL) == 0 {
		fmt.Println("DATABASE_URL not found in .env file")
		return
	}

	// Connect to MongoDB
	var mongoClient *mongo.Client
	mongoClient, err = mongo.Connect(context.Background(), options.Client().ApplyURI(dbURL))
	if err != nil {
		panic(err)
	}
	defer mongoClient.Disconnect(context.Background())

	// Test MongoDB connection
	if mongoClient.Ping(context.Background(), nil) != nil {
		fmt.Println("Failed to connect to MongoDB:", mongoClient.Ping(context.Background(), nil))
		return
	}
	fmt.Println("Successfully connected to MongoDB!")

	// Initialize Gin router
	router := gin.New()

	// Configure CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Authorization", "Content-Type"}
	router.Use(cors.New(corsConfig))
	router.Use(gin.Recovery(), gin.Logger())

	// Initialize services and controllers
	signupService := service.NewSignupService(mongoClient, databaseName, usersCollection)
	signupController := controller.NewSignupController(signupService)

	loginService := service.NewLoginService(mongoClient, databaseName, usersCollection)
	jwtService := service.NewJWTService()
	loginController := controller.NewLoginController(loginService, jwtService)

	// Health check endpoint
	router.GET("/health", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"status": "UP"})
	})

	// Authentication routes
	authRoutes := router.Group("/auth")
	{
		authRoutes.POST("/signup", func(ctx *gin.Context) {
			message := signupController.Signup(ctx)
			if message != "" {
				ctx.JSON(http.StatusOK, gin.H{"message": message})
			} else {
				ctx.JSON(http.StatusBadRequest, nil)
			}
		})

		authRoutes.POST("/login", func(ctx *gin.Context) {
			token := loginController.Login(ctx)
			if len(token) > 0 {
				ctx.JSON(http.StatusOK, gin.H{"token": token})
			} else {
				ctx.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid credentials"})
			}
		})
	}

	// Document service and controller
	documentService := service.NewDocumentService(mongoClient, databaseName, documentsCollection)
	documentController := controller.NewDocumentController(documentService)

	// Document routes (protected)
	documentRoutes := router.Group("/documents")
	documentRoutes.Use(middlewares.AuthorizeJWT())
	{
		documentRoutes.GET("/handler", func(ctx *gin.Context) {
			documentID := ctx.Query("document_id")
			handleWebSocket(ctx, documentID, documentController)
		})

		documentRoutes.POST("/getall", func(ctx *gin.Context) {
			documents, err := documentController.GetAllDocuments(ctx)
			if err != nil {
				return
			}
			ctx.JSON(http.StatusOK, gin.H{"documents": documents})
		})

		documentRoutes.POST("/search", func(ctx *gin.Context) {
			documents, err := documentController.SearchDocuments(ctx)
			if err != nil {
				fmt.Println("Error searching documents:", err)
				return
			}
			ctx.JSON(http.StatusOK, gin.H{"documents": documents})
		})

		documentRoutes.POST("/createnew", func(ctx *gin.Context) {
			documentController.CreateNewDocument(ctx)
		})

		documentRoutes.POST("/getone/:id", func(ctx *gin.Context) {
			document, err := initializeDocumentCache(ctx, documentController)
			if err != nil {
				fmt.Printf("Error getting document: %v", err)
				return
			}
			ctx.JSON(http.StatusOK, document)
		})

		documentRoutes.POST("/updatetitle", func(ctx *gin.Context) {
			title, documentID := documentController.UpdateTitle(ctx)
			updateDocumentTitleCacheAttribute(documentID, title)
		})

		documentRoutes.POST("/updatecollaborators", func(ctx *gin.Context) {
			document := documentController.UpdateCollaborators(ctx)
			access := &dto.Access{
				ID:          document.ID,
				ReadAccess:  document.ReadAccess,
				WriteAccess: document.WriteAccess,
			}
			updateDocumentCacheAttribute(document.ID, documentController, *access)
		})

		documentRoutes.DELETE("/delete/:id", func(ctx *gin.Context) {
			documentController.DeleteDocument(ctx)
		})
	}

	// Start background database sync
	updateDatabaseWithCache(documentController)

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Start server
	router.Run("0.0.0.0:" + port)
}

func handleWebSocket(ctx *gin.Context, documentID string, documentController controller.DocumentController) {
	fmt.Println("Handling WebSocket connection for document:", documentID)
	fmt.Println("Connection handled by server running on port:", os.Getenv("PORT"))

	// Configure WebSocket upgrader
	upgrader.CheckOrigin = func(r *http.Request) bool {
		return true
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Println("Error upgrading to WebSocket:", err)
		return
	}
	defer conn.Close()

	// Get or create document WebSocket handler
	documentWS, exists := documentWebSockets[documentID]
	if !exists {
		documentWS = &DocumentWebSocket{
			Connections: make(map[*websocket.Conn]bool),
		}
		documentWebSockets[documentID] = documentWS
	}

	fmt.Println("Number of active connections:", len(documentWebSockets[documentID].Connections)+1)

	// Add connection to document WebSocket handler
	documentWS.Mutex.Lock()
	documentWS.Connections[conn] = true
	documentWS.Mutex.Unlock()

	// Create cleanup channel
	disconnectChan := make(chan *websocket.Conn, 1)
	sourceConn := conn

	// Handle connection cleanup in goroutine
	go func(dws *DocumentWebSocket, dc chan *websocket.Conn, src *websocket.Conn, did string) {
		select {
		case <-dc:
			dws.Mutex.Lock()
			delete(dws.Connections, src)
			if len(dws.Connections) == 0 {
				fmt.Println("No more connections. Cleaning up resources for document:", did)
				documentCache.Delete(did)
				delete(documentWebSockets, did)
			}
			dws.Mutex.Unlock()
		}
	}(documentWS, disconnectChan, sourceConn, documentID)

	// Main message handling loop
	for {
		_, messageBytes, err := conn.ReadMessage()
		if err != nil {
			log.Println("Error reading message:", err)
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Error reading message: %v", err)
			}
			break
		}

		// Parse incoming message
		var message dto.Message
		if json.Unmarshal(messageBytes, &message) != nil {
			log.Println("Error unmarshalling document:", json.Unmarshal(messageBytes, &message))
			continue
		}

		// Update document cache
		if updateDocumentCache(documentID, documentController, message.Data) != nil {
			log.Println("Error updating document cache:", updateDocumentCache(documentID, documentController, message.Data))
			continue
		}

		// Broadcast changes to other connections
		documentWS.Mutex.Lock()
		for clientConn := range documentWS.Connections {
			if clientConn == sourceConn {
				continue
			}

			changeData, err := json.Marshal(message.Change)
			if err != nil {
				log.Println("Error marshalling message:", err)
				continue
			}

			if clientConn.WriteMessage(websocket.TextMessage, changeData) != nil {
				log.Println("Error writing message:", clientConn.WriteMessage(websocket.TextMessage, changeData))
				clientConn.Close()
				disconnectChan <- clientConn
				delete(documentWS.Connections, clientConn)
			}
		}
		documentWS.Mutex.Unlock()
	}

	close(disconnectChan)
}

func initializeDocumentCache(ctx *gin.Context, documentController controller.DocumentController) (*dto.Document, error) {
	documentID := ctx.Param("id")
	var document *dto.Document

	if cached, exists := documentCache.Load(documentID); !exists {
		var err error
		document, err = documentController.GetOneDocument(ctx)
		if err != nil {
			fmt.Println("Error getting document:", err)
			return nil, err
		}
		documentCache.Store(documentID, document)
		ctx.JSON(http.StatusOK, document)
	} else {
		document = cached.(*dto.Document)
	}

	return document, nil
}

func updateDocumentCache(documentID string, documentController controller.DocumentController, newData dto.DocumentData) error {
	cached, exists := documentCache.Load(documentID)
	if !exists {
		return fmt.Errorf("document not found in cache")
	}

	document := cached.(*dto.Document)
	document.Data = newData
	documentCache.Store(documentID, document)
	return nil
}

func updateDatabaseWithCache(documentController controller.DocumentController) {
	ticker := time.NewTicker(30 * time.Second)
	go func(t *time.Ticker, dc controller.DocumentController) {
		for {
			select {
			case <-t.C:
				if err := syncDatabaseWithCache(dc); err != nil {
					fmt.Println("Error updating database with cache:", err)
				}
			}
		}
	}(ticker, documentController)
}

func syncDatabaseWithCache(documentController controller.DocumentController) error {
	documentCache.Range(func(key, value interface{}) bool {
		documentID := key.(string)
		document := value.(*dto.Document)
		if err := documentController.UpdateDocument(documentID, document.Data); err != nil {
			fmt.Printf("Error updating database for document %s: %v\n", documentID, err)
		}
		return true
	})
	return nil
}

func updateDocumentCacheAttribute(documentID string, documentController controller.DocumentController, newData dto.Access) error {
	fmt.Print("Updating document cache attribute\n")
	cached, exists := documentCache.Load(documentID)
	if !exists {
		return fmt.Errorf("document not found in cache")
	}

	document := cached.(*dto.Document)
	document.ReadAccess = newData.ReadAccess
	document.WriteAccess = newData.WriteAccess
	documentCache.Store(documentID, document)
	return nil
}

func updateDocumentTitleCacheAttribute(documentID string, newTitle string) error {
	fmt.Print("Updating document title cache attribute\n", documentID, newTitle)
	cached, exists := documentCache.Load(documentID)
	if !exists {
		return fmt.Errorf("document not found in cache")
	}

	document := cached.(*dto.Document)
	document.Title = newTitle
	documentCache.Store(documentID, document)
	return nil
}