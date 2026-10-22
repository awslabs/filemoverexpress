package service

import (
	"fmt"
	"net"
	"net/http"
	"net/netip"

	"connectrpc.com/connect"

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

	srv := &http.Server{
		Addr:    address,
		Handler: mux,
	}
	srv.Protocols = new(http.Protocols)
	srv.Protocols.SetHTTP1(true)
	srv.Protocols.SetHTTP2(true)

	if cfg.APIServer.TLSSettings.Enabled {
		if err := validateTLSSettings(cfg.APIServer.TLSSettings.CertificateFile, cfg.APIServer.TLSSettings.KeyFile); err != nil {
			logger.Fatal(err.Error())
		}

		logger.Info("Starting HTTPS listener")
		err := srv.ListenAndServeTLS(
			cfg.APIServer.TLSSettings.CertificateFile,
			cfg.APIServer.TLSSettings.KeyFile,
		)
		if err != nil {
			logger.Fatal(err.Error())
		}
	} else {
		logger.Info("Starting HTTP listener")
		err := srv.ListenAndServe()
		if err != nil {
			logger.Fatal(err.Error())
		}
	}
}

func startApi(serviceConfig types.ServiceConfig) *FileMoverServer {
	fmeServer := FileMoverServer{}
	mux := http.NewServeMux()
	interceptors := connect.WithInterceptors(
		types.NewOriginInterceptor(serviceConfig),
		types.NewAuthInterceptor(serviceConfig),
	)
	path, handler := fmev1connect.NewFmeServiceHandler(&fmeServer, interceptors)
	mux.Handle(path, types.NewResponseHeader(handler))

	for _, port := range serviceConfig.Ports {
		go startServer(mux, serviceConfig.Host, port)
	}

	return &fmeServer
}

func destroyListener(listenerId string) {
	removeListenerErr := events.Events.RemoveListener(listenerId)
	if removeListenerErr != nil {
		logger.Error("Failed to unregister listener: %s", removeListenerErr)
	}
}

// isLocalClient reports whether an RPC arrived from the loopback interface. It is the primary
// authorization for credential-writing RPCs (Create/Update/Delete/TestStaticCredentials) and for
// SetConfiguration when AllowUIConfiguration is false.
//
// Trust boundary: a loopback peer is treated as fully trusted. This is sound because the daemon
// binds loopback-only by default (service.GrpcDefaultHost = 127.0.0.1); the only non-loopback bind
// is --remote mode, which is fatal without both TLS and a pre-shared key, and even then remote
// credential edits require the owner to opt in via AllowUIConfiguration. Caveat worth noting: on a
// shared multi-user host, any local process (or a loopback-terminating proxy such as a userland
// port-forward) that reaches the listener is within this boundary, so the credential store assumes
// a single-user host or a trusted set of local users.
//
// The address is parsed as an IP and tested with netip's IsLoopback rather than matched by string
// prefix, so spoofable prefixes like "127.evil" cannot pass and IPv6 loopback is handled correctly.
func isLocalClient(peer connect.Peer) bool {
	host := peer.Addr
	if h, _, err := net.SplitHostPort(peer.Addr); err == nil {
		host = h
	}
	addr, err := netip.ParseAddr(host)
	if err != nil {
		return false
	}
	return addr.IsLoopback()
}
