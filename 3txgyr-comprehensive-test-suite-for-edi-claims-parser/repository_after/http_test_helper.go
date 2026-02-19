package collaborate

import (
	"encoding/json"
	"net"
	"net/http"
	"sync"
)

const parseAddr = "127.0.0.1:3000"

var (
	parseServerMu   sync.Mutex
	parseServer     *http.Server
	parseListener   net.Listener
)

// startParseServerOn3000 starts an HTTP server on 127.0.0.1:3000 for POST /parse.
// parseClaimEdi hardcodes localhost:3000; tests must use this to mock the parser service.
// Only one server runs at a time; starting a new one closes the previous.
func startParseServerOn3000(t interface {
	Helper()
	Cleanup(func())
}) *http.ServeMux {
	t.Helper()
	parseServerMu.Lock()
	if parseListener != nil {
		_ = parseListener.Close()
		parseListener = nil
	}
	if parseServer != nil {
		_ = parseServer.Close()
		parseServer = nil
	}
	mux := http.NewServeMux()
	ln, err := net.Listen("tcp", parseAddr)
	if err != nil {
		parseServerMu.Unlock()
		panic("listen on " + parseAddr + ": " + err.Error())
	}
	parseListener = ln
	parseServer = &http.Server{Handler: mux}
	myServer, myListener := parseServer, parseListener
	parseServerMu.Unlock()

	go func() { _ = myServer.Serve(myListener) }()

	t.Cleanup(func() {
		parseServerMu.Lock()
		defer parseServerMu.Unlock()
		if parseServer == myServer {
			_ = parseServer.Close()
			_ = parseListener.Close()
			parseServer, parseListener = nil, nil
		}
	})
	return mux
}

// respondJSON writes JSON and sets Content-Type. Used by parse handlers.
func respondJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
