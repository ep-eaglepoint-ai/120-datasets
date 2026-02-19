package main

import (
	"fmt"
	"go-proxy/repository_after/app"
	"net/http"
)

func main() {
	serverAddressList := []string{
		"https://distributed-doc.onrender.com",
		"https://distributed-doc-2.onrender.com",
		"https://distributed-doc-3.onrender.com",
	}

	var interfaceList []app.ServerInterface
	for i, addr := range serverAddressList {
		interfaceList = append(interfaceList, app.CreateNewSimpleServerInstance(addr, i))
	}

	lb := app.CreateNewLoadBalancerInstance("7000", interfaceList)

	// Mux registration
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		lb.HandleProxyServing(w, r)
	})

	listenAddr := "0.0.0.0:" + lb.PortNumber
	fmt.Printf("Starting Enterprise Load Balancer on %s\n", listenAddr)

	if err := http.ListenAndServe(listenAddr, nil); err != nil {
		app.HandleErrorFunction(err)
	}
}