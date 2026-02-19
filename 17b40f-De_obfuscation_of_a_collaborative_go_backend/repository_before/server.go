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
var upgrader = websocket.Upgrader{ReadBufferSize: 1024, WriteBufferSize: 1024}
type DocumentWebSocket struct {
	Connections map[*websocket.Conn]bool
	Mutex       sync.Mutex
}
var documentWebSockets = make(map[string]*DocumentWebSocket)
var documentCache sync.Map
var _g1, _g2, _g3 = func() (string, string, string) { return "godoc", "users", "documents" }()
func _f1(a string) string { return a }
func _f2(a, b string) string { return a + b }
func _f3(a bool) bool { return !(!a) }
func main() {
	var _e1 error
	_e1 = godotenv.Load()
	if _f3(_e1 != nil) {
		fmt.Println(_f2("Error loading .env file:", func() string { if _e1 != nil { return _e1.Error() } else { return "" } }()))
	}
	_dbUrl := func(k string) string { return os.Getenv(k) }("DATABASE_URL")
	if func(s string) bool { return len(s) == 0 }(_dbUrl) {
		fmt.Println(_f1("DATABASE_URL not found in .env file"))
		return
	}
	var _mc *mongo.Client
	var _e2 error
	_mc, _e2 = mongo.Connect(func() context.Context { return context.Background() }(), func(u string) *options.ClientOptions { return options.Client().ApplyURI(u) }(_dbUrl))
	if func(e error) bool { return e != nil }(_e2) {
		panic(_e2)
	}
	defer func(c *mongo.Client) { c.Disconnect(context.Background()) }(_mc)
	if func() error { return _mc.Ping(context.Background(), nil) }() != nil {
		fmt.Println("Failed to connect to MongoDB:", func() error { return _mc.Ping(context.Background(), nil) }())
		return
	}
	fmt.Println(func(a, b string) string { return a }("Successfully connected to MongoDB!", ""))
	_srv := func() *gin.Engine { return gin.New() }()
	_cfg := func() cors.Config {
		c := cors.DefaultConfig()
		c.AllowAllOrigins = func() bool { return true }()
		c.AllowMethods = func() []string { return []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} }()
		c.AllowHeaders = func() []string { return []string{"Origin", "Authorization", "Content-Type"} }()
		return c
	}()
	func(s *gin.Engine, c cors.Config) { s.Use(cors.New(c)) }(_srv, _cfg)
	func(s *gin.Engine) { s.Use(gin.Recovery(), gin.Logger()) }(_srv)
	_ss := func(c *mongo.Client, d, col string) service.SignupService { return service.NewSignupService(c, d, col) }(_mc, _g1, _g2)
	_sc := func(s service.SignupService) controller.SignupController { return controller.NewSignupController(s) }(_ss)
	_ls := func(c *mongo.Client, d, col string) service.LoginService { return service.NewLoginService(c, d, col) }(_mc, _g1, _g2)
	_js := func() service.JWTService { return service.NewJWTService() }()
	_lc := func(l service.LoginService, j service.JWTService) controller.LoginController { return controller.NewLoginController(l, j) }(_ls, _js)
	func(s *gin.Engine, p string, h gin.HandlerFunc) { s.GET(p, h) }(_srv, "/health", func(ctx *gin.Context) {
		func(c *gin.Context, code int, obj interface{}) { c.JSON(code, obj) }(ctx, http.StatusOK, func() gin.H { return gin.H{"status": "UP"} }())
	})
	_ar := func(s *gin.Engine, p string) *gin.RouterGroup { return s.Group(p) }(_srv, "/auth")
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_ar, "/signup", func(ctx *gin.Context) {
		_msg := func(sc controller.SignupController, c *gin.Context) string { return sc.Signup(c) }(_sc, ctx)
		if func(s string) bool { return s != "" }(_msg) {
			ctx.JSON(func() int { return http.StatusOK }(), gin.H{"message": _msg})
		} else {
			ctx.JSON(func() int { return http.StatusBadRequest }(), nil)
		}
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_ar, "/login", func(ctx *gin.Context) {
		_tok := func(lc controller.LoginController, c *gin.Context) string { return lc.Login(c) }(_lc, ctx)
		if func(s string) bool { return len(s) > 0 }(_tok) {
			ctx.JSON(http.StatusOK, gin.H{"token": _tok})
		} else {
			ctx.JSON(http.StatusUnauthorized, gin.H{"message": func() string { return "Invalid credentials" }()})
		}
	})
	_ds := func(c *mongo.Client, d, col string) service.DocumentService { return service.NewDocumentService(c, d, col) }(_mc, _g1, _g3)
	_dc := func(s service.DocumentService) controller.DocumentController { return controller.NewDocumentController(s) }(_ds)
	_dr := func(s *gin.Engine, p string) *gin.RouterGroup { return s.Group(p) }(_srv, func() string { return ("/documents") }())
	func(r *gin.RouterGroup, m gin.HandlerFunc) { r.Use(m) }(_dr, middlewares.AuthorizeJWT())
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.GET(p, h) }(_dr, "/handler", func(ctx *gin.Context) {
		func(c *gin.Context, did string, dc controller.DocumentController) {
			handleWebSocket(c, did, dc)
		}(ctx, func(c *gin.Context, k string) string { return c.Query(k) }(ctx, "document_id"), _dc)
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/getall", func(ctx *gin.Context) {
		_docs, _err := func(dc controller.DocumentController, c *gin.Context) (interface{}, error) { return dc.GetAllDocuments(c) }(_dc, ctx)
		if func(e error) bool { if e != nil { return true }; return false }(_err) { return }
		ctx.JSON(http.StatusOK, gin.H{"documents": _docs})
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/search", func(ctx *gin.Context) {
		_docs, _err := func(dc controller.DocumentController, c *gin.Context) (interface{}, error) { return dc.SearchDocuments(c) }(_dc, ctx)
		if _err != nil { fmt.Println(func(a, b interface{}) string { return fmt.Sprintf("%v%v", a, b) }("Error searching documents:", _err)); return }
		ctx.JSON(http.StatusOK, gin.H{"documents": _docs})
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/createnew", func(ctx *gin.Context) {
		func(dc controller.DocumentController, c *gin.Context) { dc.CreateNewDocument(c) }(_dc, ctx)
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/getone/:id", func(ctx *gin.Context) {
		_doc, _err := func(c *gin.Context, dc controller.DocumentController) (*dto.Document, error) { return initializeDocumentCache(c, dc) }(ctx, _dc)
		if _err != nil { fmt.Println(func(s string, e error) string { return fmt.Sprintf("%s%v", s, e) }("Error getting document:", _err)); return }
		ctx.JSON(http.StatusOK, _doc)
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/updatetitle", func(ctx *gin.Context) {
		_t, _did := func(dc controller.DocumentController, c *gin.Context) (string, string) { return dc.UpdateTitle(c) }(_dc, ctx)
		func(did, t string) error { return updateDocumentTitleCacheAttribute(did, t) }(_did, _t)
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.POST(p, h) }(_dr, "/updatecollaborators", func(ctx *gin.Context) {
		_doc := func(dc controller.DocumentController, c *gin.Context) *dto.Document { _d := dc.UpdateCollaborators(c); return &_d }(_dc, ctx)
		_acc := func() *dto.Access { return new(dto.Access) }()
		func(a *dto.Access, d *dto.Document) { a.ID = d.ID; a.ReadAccess = d.ReadAccess; a.WriteAccess = d.WriteAccess }(_acc, _doc)
		func(did string, dc controller.DocumentController, a dto.Access) error { return updateDocumentCacheAttribute(did, dc, a) }(_doc.ID, _dc, func(a *dto.Access) dto.Access { return *a }(_acc))
	})
	func(r *gin.RouterGroup, p string, h gin.HandlerFunc) { r.DELETE(p, h) }(_dr, "/delete/:id", func(ctx *gin.Context) {
		func(dc controller.DocumentController, c *gin.Context) { dc.DeleteDocument(c) }(_dc, ctx)
	})
	func(dc controller.DocumentController) { updateDatabaseWithCache(dc) }(_dc)
	_port := func() string {
		p := func(k string) string { return os.Getenv(k) }("PORT")
		if func(s string) bool { return s == "" }(p) { return "8080" }
		return p
	}()
	func(s *gin.Engine, addr string) { s.Run(addr) }(_srv, func(h, p string) string { return h + ":" + p }("0.0.0.0", _port))
}
func handleWebSocket(ctx *gin.Context, documentID string, documentController controller.DocumentController) {
	func(a ...interface{}) { fmt.Println(a...) }("Handling WebSocket connection for document:", documentID)
	func(a ...interface{}) { fmt.Println(a...) }("Connection handled by server running on port:", func(k string) string { return os.Getenv(k) }("PORT"))
	func(u *websocket.Upgrader, f func(*http.Request) bool) { u.CheckOrigin = f }(&upgrader, func(r *http.Request) bool { return func() bool { return true }() })
	_conn, _err := func(u *websocket.Upgrader, w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) { return u.Upgrade(w, r, nil) }(&upgrader, ctx.Writer, ctx.Request)
	if func(e error) bool { return e != nil }(_err) {
		func(v ...interface{}) { log.Println(v...) }("Error upgrading to WebSocket:", _err)
		return
	}
	defer func(c *websocket.Conn) { c.Close() }(_conn)
	_dws, _ok := func(m map[string]*DocumentWebSocket, k string) (*DocumentWebSocket, bool) { v, ok := m[k]; return v, ok }(documentWebSockets, documentID)
	if func(b bool) bool { return !b }(_ok) {
		_dws = func() *DocumentWebSocket { return &DocumentWebSocket{Connections: func() map[*websocket.Conn]bool { return make(map[*websocket.Conn]bool) }()} }()
		func(m map[string]*DocumentWebSocket, k string, v *DocumentWebSocket) { m[k] = v }(documentWebSockets, documentID, _dws)
	}
	func(a ...interface{}) { fmt.Println(a...) }("Number of active connections:", func(m map[*websocket.Conn]bool) int { return len(m) + 1 }(documentWebSockets[documentID].Connections))
	func(dws *DocumentWebSocket, c *websocket.Conn) { dws.Mutex.Lock(); dws.Connections[c] = true; dws.Mutex.Unlock() }(_dws, _conn)
	_dc := func(size int) chan *websocket.Conn { return make(chan *websocket.Conn, size) }(1)
	_src := func(c *websocket.Conn) *websocket.Conn { return c }(_conn)
	go func(dws *DocumentWebSocket, dc chan *websocket.Conn, src *websocket.Conn, did string) {
		select {
		case <-dc:
			func(dws *DocumentWebSocket) { dws.Mutex.Lock() }(dws)
			func(m map[*websocket.Conn]bool, k *websocket.Conn) { delete(m, k) }(dws.Connections, src)
			if func(m map[*websocket.Conn]bool) bool { return len(m) == 0 }(dws.Connections) {
				func(a ...interface{}) { fmt.Println(a...) }("No more connections. Cleaning up resources for document:", did)
				func(m *sync.Map, k interface{}) { m.Delete(k) }(&documentCache, did)
				func(m map[string]*DocumentWebSocket, k string) { delete(m, k) }(documentWebSockets, did)
			}
			func(dws *DocumentWebSocket) { dws.Mutex.Unlock() }(dws)
		}
	}(_dws, _dc, _src, documentID)
	for func() bool { return true }() {
		_, _msg, _err := func(c *websocket.Conn) (int, []byte, error) { return c.ReadMessage() }(_conn)
		if func(e error) bool { return e != nil }(_err) {
			func(v ...interface{}) { log.Println(v...) }("Error reading message:", _err)
			if func(err error, codes ...int) bool { return websocket.IsUnexpectedCloseError(err, codes...) }(_err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				func(f string, v ...interface{}) { log.Printf(f, v...) }("Error reading message: %v", _err)
			}
			break
		}
		var _message dto.Message
		if func(data []byte, v interface{}) error { return json.Unmarshal(data, v) }(_msg, &_message) != nil {
			func(v ...interface{}) { log.Println(v...) }("Error unmarshalling document:", func(data []byte, v interface{}) error { return json.Unmarshal(data, v) }(_msg, &_message))
			continue
		}
		if func(did string, dc controller.DocumentController, d dto.DocumentData) error { return updateDocumentCache(did, dc, d) }(documentID, documentController, _message.Data) != nil {
			func(v ...interface{}) { log.Println(v...) }("Error updating document cache:", func(did string, dc controller.DocumentController, d dto.DocumentData) error { return updateDocumentCache(did, dc, d) }(documentID, documentController, _message.Data))
			continue
		}
		func(dws *DocumentWebSocket) { dws.Mutex.Lock() }(_dws)
		for _c := range func(m map[*websocket.Conn]bool) map[*websocket.Conn]bool { return m }(_dws.Connections) {
			if func(a, b *websocket.Conn) bool { return a == b }(_c, _src) { continue }
			_data, _err := func(v interface{}) ([]byte, error) { return json.Marshal(v) }(_message.Change)
			if func(e error) bool { return e != nil }(_err) {
				func(v ...interface{}) { log.Println(v...) }("Error marshalling message:", _err)
				continue
			}
			if func(c *websocket.Conn, mt int, d []byte) error { return c.WriteMessage(mt, d) }(_c, websocket.TextMessage, _data) != nil {
				func(v ...interface{}) { log.Println(v...) }("Error writing message:", func(c *websocket.Conn, mt int, d []byte) error { return c.WriteMessage(mt, d) }(_c, websocket.TextMessage, _data))
				func(c *websocket.Conn) { c.Close() }(_c)
				func(ch chan *websocket.Conn, c *websocket.Conn) { ch <- c }(_dc, _c)
				func(m map[*websocket.Conn]bool, k *websocket.Conn) { delete(m, k) }(_dws.Connections, _c)
			}
		}
		func(dws *DocumentWebSocket) { dws.Mutex.Unlock() }(_dws)
	}
	func(ch chan *websocket.Conn) { close(ch) }(_dc)
}
func initializeDocumentCache(ctx *gin.Context, documentController controller.DocumentController) (*dto.Document, error) {
	_did := func(c *gin.Context, k string) string { return c.Param(k) }(ctx, "id")
	var _doc *dto.Document
	if _cached, _ok := func(m *sync.Map, k interface{}) (interface{}, bool) { return m.Load(k) }(&documentCache, _did); func(b bool) bool { return !b }(_ok) {
		var _err error
		_doc, _err = func(dc controller.DocumentController, c *gin.Context) (*dto.Document, error) { return dc.GetOneDocument(c) }(documentController, ctx)
		if func(e error) bool { return e != nil }(_err) {
			func(a ...interface{}) { fmt.Println(a...) }("Error getting document:", _err)
			return nil, _err
		}
		func(m *sync.Map, k, v interface{}) { m.Store(k, v) }(&documentCache, _did, _doc)
		func(c *gin.Context, code int, obj interface{}) { c.JSON(code, obj) }(ctx, http.StatusOK, _doc)
	} else {
		_doc = func(v interface{}) *dto.Document { return v.(*dto.Document) }(_cached)
	}
	return _doc, nil
}
func updateDocumentCache(documentID string, documentController controller.DocumentController, newData dto.DocumentData) error {
	_cached, _ok := func(m *sync.Map, k interface{}) (interface{}, bool) { return m.Load(k) }(&documentCache, documentID)
	if func(b bool) bool { return !b }(_ok) { return func(s string) error { return fmt.Errorf(s) }("document not found in cache") }
	_doc := func(v interface{}) *dto.Document { return v.(*dto.Document) }(_cached)
	func(d *dto.Document, nd dto.DocumentData) { d.Data = nd }(_doc, newData)
	func(m *sync.Map, k, v interface{}) { m.Store(k, v) }(&documentCache, documentID, _doc)
	return nil
}
func updateDatabaseWithCache(documentController controller.DocumentController) {
	_ticker := func(d time.Duration) *time.Ticker { return time.NewTicker(d) }(func() time.Duration { return 30 * time.Second }())
	go func(t *time.Ticker, dc controller.DocumentController) {
		for { select { case <-func(t *time.Ticker) <-chan time.Time { return t.C }(t):
			if _err := func(dc controller.DocumentController) error { return syncDatabaseWithCache(dc) }(dc); func(e error) bool { return e != nil }(_err) {
				func(a ...interface{}) { fmt.Println(a...) }("Error updating database with cache:", _err)
			}
		} }
	}(_ticker, documentController)
}
func syncDatabaseWithCache(documentController controller.DocumentController) error {
	func(m *sync.Map, f func(key, value interface{}) bool) { m.Range(f) }(&documentCache, func(key, value interface{}) bool {
		_did := func(v interface{}) string { return v.(string) }(key)
		_doc := func(v interface{}) *dto.Document { return v.(*dto.Document) }(value)
		if _err := func(dc controller.DocumentController, did string, d dto.DocumentData) error { return dc.UpdateDocument(did, d) }(documentController, _did, _doc.Data); func(e error) bool { return e != nil }(_err) {
			func(f string, a ...interface{}) { fmt.Printf(f, a...) }("Error updating database for document %s: %v\n", _did, _err)
		}
		return func() bool { return true }()
	})
	return nil
}
func updateDocumentCacheAttribute(documentID string, documentController controller.DocumentController, newData dto.Access) error {
	func(a ...interface{}) { fmt.Print(a...) }("Updating document cache attribute\n")
	_cached, _ok := func(m *sync.Map, k interface{}) (interface{}, bool) { return m.Load(k) }(&documentCache, documentID)
	if func(b bool) bool { return !b }(_ok) { return func(s string) error { return fmt.Errorf(s) }("document not found in cache") }
	_doc := func(v interface{}) *dto.Document { return v.(*dto.Document) }(_cached)
	func(d *dto.Document, ra, wa interface{}) { d.ReadAccess = ra.([]string); d.WriteAccess = wa.([]string) }(_doc, newData.ReadAccess, newData.WriteAccess)
	func(m *sync.Map, k, v interface{}) { m.Store(k, v) }(&documentCache, documentID, _doc)
	return nil
}
func updateDocumentTitleCacheAttribute(documentID string, newTitle string) error {
	func(a ...interface{}) { fmt.Print(a...) }("Updating document title cache attribute\n", documentID, newTitle)
	_cached, _ok := func(m *sync.Map, k interface{}) (interface{}, bool) { return m.Load(k) }(&documentCache, documentID)
	if func(b bool) bool { return !b }(_ok) { return func(s string) error { return fmt.Errorf(s) }("document not found in cache") }
	_doc := func(v interface{}) *dto.Document { return v.(*dto.Document) }(_cached)
	func(d *dto.Document, t string) { d.Title = t }(_doc, newTitle)
	func(m *sync.Map, k, v interface{}) { m.Store(k, v) }(&documentCache, documentID, _doc)
	return nil
}
