package main

import (
	"fmt"
	"go-proxy/repository_before/app"
	"net/http"
)

func main() {
	serverAddressList := []string{
		"https://distributed-doc.onrender.com",
		"https://distributed-doc-2.onrender.com",
		"https://distributed-doc-3.onrender.com",
	}

	serverInterfaceList := make([]app.ServerInterface, 0)

	for index := 0; index < len(serverAddressList); index++ {
		currentAddress := serverAddressList[index]
		newServer := app.CreateNewSimpleServerInstance(currentAddress, index)
		serverInterfaceList = append(serverInterfaceList, newServer)
	}

	portNumberString := "7000"
	loadBalancerInstance := app.CreateNewLoadBalancerInstance(portNumberString, serverInterfaceList)

	requestHandlerFunction := func(responseWriter http.ResponseWriter, httpRequest *http.Request) {
		loadBalancerInstance.HandleProxyServing(responseWriter, httpRequest)
	}

	rootPath := "/"
	http.HandleFunc(rootPath, requestHandlerFunction)

	listenAddress := "0.0.0.0"
	colonSeparator := ":"
	portNumber := loadBalancerInstance.PortNumber
	fullListenAddress := listenAddress + colonSeparator + portNumber

	fmt.Printf("Starting server on %s\n", fullListenAddress)
	serverError := http.ListenAndServe(fullListenAddress, nil)
	if serverError != nil {
		app.HandleErrorFunction(serverError)
	}
}