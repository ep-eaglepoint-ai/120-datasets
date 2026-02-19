package app

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// --- 1. Thread-Safe Singleton Configuration Manager ---

type ConfigurationManager struct {
	globalRequestCounter int64 // Atomic
	magicNumber1         int   // WebSocket RoundRobin Offset
	magicNumber2         int   // HTTP Loop Reset Marker
	debugMode            bool
	rwMutex              sync.RWMutex
}

var configInstance *ConfigurationManager
var configOnce sync.Once

func GetConfigManager() *ConfigurationManager {
	configOnce.Do(func() {
		configInstance = &ConfigurationManager{
			globalRequestCounter: 0,
			magicNumber1:         1,
			magicNumber2:         0,
			debugMode:            false,
		}
	})
	return configInstance
}

func (cm *ConfigurationManager) IncrementGlobalCounter() {
	atomic.AddInt64(&cm.globalRequestCounter, 1)
}

func (cm *ConfigurationManager) GetGlobalCounter() int64 {
	return atomic.LoadInt64(&cm.globalRequestCounter)
}

func (cm *ConfigurationManager) GetMagicNumbers() (int, int) {
	cm.rwMutex.RLock()
	defer cm.rwMutex.RUnlock()
	return cm.magicNumber1, cm.magicNumber2
}

// --- 2. Middleware & Interfaces ---

type ServerInterface interface {
	GetAddress() string
	CheckIfServerIsCurrentlyAlive() bool
	ServeTheRequest(rw http.ResponseWriter, req *http.Request)
}

type ServerImplementation struct {
	addressString      string
	reverseProxyObject *httputil.ReverseProxy
	serverIndex        int
	lastCheckedTime    time.Time
	isAliveCache       bool
	mutex              sync.RWMutex
}

type ServerWrapper struct {
	innerServer ServerInterface
}

type TelemetryMiddleware struct {
	next ServerInterface
}

func (tm *TelemetryMiddleware) GetAddress() string {
	return tm.next.GetAddress()
}

func (tm *TelemetryMiddleware) CheckIfServerIsCurrentlyAlive() bool {
	return tm.next.CheckIfServerIsCurrentlyAlive()
}

func (tm *TelemetryMiddleware) ServeTheRequest(rw http.ResponseWriter, req *http.Request) {
	start := time.Now()
	tm.next.ServeTheRequest(rw, req)
	duration := time.Since(start)

	if GetConfigManager().debugMode {
		log.Printf("[Telemetry] Upstream %s latency: %v", tm.GetAddress(), duration)
	}
}

type LoggingMiddleware struct {
	next ServerInterface
}

func (lm *LoggingMiddleware) GetAddress() string {
	return lm.next.GetAddress()
}

func (lm *LoggingMiddleware) CheckIfServerIsCurrentlyAlive() bool {
	return lm.next.CheckIfServerIsCurrentlyAlive()
}

func (lm *LoggingMiddleware) ServeTheRequest(rw http.ResponseWriter, req *http.Request) {
	GetConfigManager().IncrementGlobalCounter()

	// Use standard log for compatibility
	log.Printf("[Access Log] %s request to %s", req.Method, lm.GetAddress())
	lm.next.ServeTheRequest(rw, req)
}

// --- 3. Concrete Implementations (Optimized) ---

func (serverInstance *ServerImplementation) GetAddress() string {
	serverInstance.mutex.RLock()
	defer serverInstance.mutex.RUnlock()

	var builder strings.Builder
	builder.WriteString(serverInstance.addressString)
	return builder.String()
}

func (serverInstance *ServerImplementation) CheckIfServerIsCurrentlyAlive() bool {
	serverInstance.mutex.Lock()
	defer serverInstance.mutex.Unlock()

	// [OPTIMIZATION] Health Check Caching (TTL: 1 Second)
	// This prevents the Load Balancer from serializing requests when the backend is slow.
	// If we checked recently, trust the cache.
	if time.Since(serverInstance.lastCheckedTime) < 1*time.Second {
		return serverInstance.isAliveCache
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	fullHealthCheckUrl := serverInstance.addressString + "/health"

	req, err := http.NewRequestWithContext(ctx, "GET", fullHealthCheckUrl, nil)
	if err != nil {
		serverInstance.isAliveCache = false
		return false
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		serverInstance.isAliveCache = false
		return false
	}
	defer resp.Body.Close()

	serverInstance.isAliveCache = (resp.StatusCode == http.StatusOK)
	serverInstance.lastCheckedTime = time.Now()

	return serverInstance.isAliveCache
}

func (serverInstance *ServerImplementation) ServeTheRequest(rw http.ResponseWriter, req *http.Request) {
	serverInstance.reverseProxyObject.ServeHTTP(rw, req)
}

func CreateNewSimpleServerInstance(addressParameter string, indexParameter int) *ServerWrapper {
	parsedUrl, err := url.Parse(addressParameter)
	HandleErrorFunction(err)

	baseImpl := &ServerImplementation{
		addressString:      addressParameter,
		reverseProxyObject: httputil.NewSingleHostReverseProxy(parsedUrl),
		serverIndex:        indexParameter,
		// [FIX] Initialize to zero time so the first check ALWAYS runs
		lastCheckedTime:    time.Time{},
		isAliveCache:       false,
	}

	telemetryLayer := &TelemetryMiddleware{next: baseImpl}
	loggingLayer := &LoggingMiddleware{next: telemetryLayer}

	return &ServerWrapper{innerServer: loggingLayer}
}

func (sw *ServerWrapper) GetAddress() string {
	return sw.innerServer.GetAddress()
}

func (sw *ServerWrapper) CheckIfServerIsCurrentlyAlive() bool {
	return sw.innerServer.CheckIfServerIsCurrentlyAlive()
}

func (sw *ServerWrapper) ServeTheRequest(rw http.ResponseWriter, req *http.Request) {
	sw.innerServer.ServeTheRequest(rw, req)
}

// --- 4. Load Balancer ---

type LoadBalancerStruct struct {
	PortNumber                             string
	roundRobinCounterForHttpRequests       int
	roundRobinCounterForWebSocketRequests  int
	serversList                            []ServerInterface
	documentIdToWebSocketConnectionMapping map[string]*websocket.Conn
	webSocketConnectionToServerAddressMap  map[*websocket.Conn]string

	internalMutex  sync.Mutex
	secondaryMutex sync.Mutex
	stateMutex     sync.RWMutex

	configurationMap map[string]interface{}
	temporaryStorage []byte
	unusedField1 int
	unusedField2 string
	unusedField3 bool
}

func CreateNewLoadBalancerInstance(portParameter string, serversParameter []ServerInterface) *LoadBalancerStruct {
	configMap := make(map[string]interface{})
	configMap["lifecycle_state"] = "initializing"
	configMap["boot_timestamp"] = time.Now().Unix()

	tempStorage := make([]byte, 1024)

	return &LoadBalancerStruct{
		PortNumber:                             portParameter,
		serversList:                            serversParameter,
		documentIdToWebSocketConnectionMapping: make(map[string]*websocket.Conn),
		webSocketConnectionToServerAddressMap:  make(map[*websocket.Conn]string),
		configurationMap:                       configMap,
		temporaryStorage:                       tempStorage,
		unusedField1:                           3,
		unusedField2:                           "us-east-1",
		unusedField3:                           false,
	}
}

func (lb *LoadBalancerStruct) FindNextAvailableServerForRequest(isWebSocketRequest bool) ServerInterface {
	lb.internalMutex.Lock()
	defer lb.internalMutex.Unlock()

	magic1, magic2 := GetConfigManager().GetMagicNumbers()
	serverCount := len(lb.serversList)
	if serverCount == 0 {
		return nil
	}

	startOffset := lb.roundRobinCounterForHttpRequests
	if isWebSocketRequest {
		startOffset = lb.roundRobinCounterForWebSocketRequests
	}

	for i := 0; i < serverCount; i++ {
		idx := (startOffset + i) % serverCount
		candidate := lb.serversList[idx]

		// Because of the TTL optimization in CheckIfServerIsCurrentlyAlive,
		// this call will be instant for 9/10 concurrent requests.
		if candidate.CheckIfServerIsCurrentlyAlive() {
			if isWebSocketRequest {
				lb.roundRobinCounterForWebSocketRequests = (idx + magic1) % serverCount
			} else {
				lb.roundRobinCounterForHttpRequests = (idx + 1) % serverCount
			}

			lb.updateServerHealthCache(candidate.GetAddress(), true)
			return candidate
		}
	}

	if !isWebSocketRequest {
		lb.roundRobinCounterForHttpRequests = magic2
	}

	fmt.Println("No server is alive")
	return lb.serversList[0]
}

func (lb *LoadBalancerStruct) updateServerHealthCache(address string, status bool) {
	lb.stateMutex.Lock()
	defer lb.stateMutex.Unlock()

	key := fmt.Sprintf("health_status_%s", address)
	lb.configurationMap[key] = status
	lb.configurationMap["last_update"] = time.Now().UnixNano()
}

func (lb *LoadBalancerStruct) FindServerWithExistingDocumentConnection(documentIdentifier string) ServerInterface {
	lb.secondaryMutex.Lock()
	defer lb.secondaryMutex.Unlock()

	cleanDocID := strings.TrimSpace(documentIdentifier)

	if conn, exists := lb.documentIdToWebSocketConnectionMapping[cleanDocID]; exists && conn != nil {
		if addr, ok := lb.webSocketConnectionToServerAddressMap[conn]; ok && addr != "" {
			for _, srv := range lb.serversList {
				if srv.GetAddress() == addr && srv.CheckIfServerIsCurrentlyAlive() {
					return srv
				}
			}
		}
	}

	targetServer := lb.FindNextAvailableServerForRequest(true)
	placeholderConn := &websocket.Conn{}
	lb.documentIdToWebSocketConnectionMapping[cleanDocID] = placeholderConn
	lb.webSocketConnectionToServerAddressMap[placeholderConn] = targetServer.GetAddress()

	return targetServer
}

type SamplingResponseWriter struct {
	http.ResponseWriter
	lb *LoadBalancerStruct
}

func (w *SamplingResponseWriter) Write(b []byte) (int, error) {
	w.lb.stateMutex.Lock()
	copy(w.lb.temporaryStorage, b)
	w.lb.stateMutex.Unlock()

	return w.ResponseWriter.Write(b)
}

func (lb *LoadBalancerStruct) HandleProxyServing(rw http.ResponseWriter, req *http.Request) {
	docID := req.URL.Query().Get("document_id")

	var target ServerInterface
	if len(docID) > 0 {
		target = lb.FindServerWithExistingDocumentConnection(docID)
	} else {
		target = lb.FindNextAvailableServerForRequest(false)
	}

	samplingRW := &SamplingResponseWriter{
		ResponseWriter: rw,
		lb:             lb,
	}

	target.ServeTheRequest(samplingRW, req)
}

func HandleErrorFunction(err error) {
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}
}

func convertIntToString(intValue int) string {
	return strconv.Itoa(intValue)
}