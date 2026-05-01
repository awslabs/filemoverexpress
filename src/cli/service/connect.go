package service

import (
	"fmt"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/service/types"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
)

type FileMoverServer struct {
	fmev1connect.UnimplementedFmeServiceHandler
}

func startServer(mux *http.ServeMux, ip string, port uint) {
	cfg := config.LoadConfiguration()
	address := fmt.Sprintf("%s:%d", ip, port)

	if cfg.APIServer.TLSSettings.Enabled {
		if err := validateTLSSettings(cfg.APIServer.TLSSettings.CertificateFile, cfg.APIServer.TLSSettings.KeyFile); err != nil {
			logger.Fatal(err.Error())
		}

		logger.Info("Starting HTTPS listener")
		err := http.ListenAndServeTLS(
			address,
			cfg.APIServer.TLSSettings.CertificateFile,
			cfg.APIServer.TLSSettings.KeyFile,
			h2c.NewHandler(mux, &http2.Server{}),
		)
		if err != nil {
			logger.Fatal(err.Error())
		}
	} else {
		logger.Info("Starting HTTP listener")
		err := http.ListenAndServe(
			address,
			h2c.NewHandler(mux, &http2.Server{}),
		)
		if err != nil {
			logger.Fatal(err.Error())
		}
	}
}

func startApi(config types.ServiceConfig) *FileMoverServer {
	fmeServer := FileMoverServer{}
	mux := http.NewServeMux()
	interceptors := connect.WithInterceptors(
		types.NewOriginInterceptor(config),
		types.NewAuthInterceptor(config),
	)
	path, handler := fmev1connect.NewFmeServiceHandler(&fmeServer, interceptors)
	mux.Handle(path, types.NewResponseHeader(handler))

	for _, port := range config.Ports {
		go startServer(mux, config.Host, port)
	}

	return &fmeServer
}

func destroyListener(listenerId string) {
	removeListenerErr := events.Events.RemoveListener(listenerId)
	if removeListenerErr != nil {
		logger.Error("Failed to unregister listener: %s", removeListenerErr)
	}
}

func isLocalClient(peer connect.Peer) bool {
	return strings.HasPrefix(peer.Addr, "127.") || strings.HasPrefix(peer.Addr, "[::1]")
}
