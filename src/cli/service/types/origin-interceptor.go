package types

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/logger"
)

// #nosec G101 -- False positives
const (
	originHeader   = "Origin"
	electronOrigin = "electron://fme-app"
)

var errInvalidOrigin = errors.New("access denied")

type OriginInterceptor struct {
	config ServiceConfig
}

func NewOriginInterceptor(config ServiceConfig) *OriginInterceptor {
	return &OriginInterceptor{
		config: config,
	}
}

func (i *OriginInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if !i.validateOrigin(req.Header().Get(originHeader), req.Peer().Addr) {
			return nil, connect.NewError(connect.CodeFailedPrecondition, errInvalidOrigin)
		}

		return next(ctx, req)
	}
}

func (i *OriginInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)

		if !i.validateOrigin(conn.RequestHeader().Get(originHeader), conn.Peer().Addr) {
			if err := conn.CloseResponse(); err != nil {
				logger.Warn(err.Error())
				return nil
			}
		}

		return conn
	}
}

func (i *OriginInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		if !i.validateOrigin(conn.RequestHeader().Get(originHeader), conn.Peer().Addr) {
			return connect.NewError(connect.CodeUnauthenticated, errInvalidOrigin)
		}

		return next(ctx, conn)
	}
}

func (*OriginInterceptor) validateOrigin(origin string, remoteAddr string) bool {
	if origin == electronOrigin {
		return true
	}
	if strings.Contains(globals.GetInstance().GetVersion(), "-local-dev") {
		// Allow Angular dev-server access when running in dev mode
		if strings.HasPrefix(origin, "http://localhost:4200") || strings.HasPrefix(origin, "http://wails.localhost") {
			return true
		}
	}

	for _, allowedOrigin := range config.LoadConfiguration().APIServer.AllowedOrigins {
		if origin == allowedOrigin {
			return true
		}
	}

	logger.Warn("Rejecting connection attempt from %s because it sent an invalid CORS header: %s", remoteAddr, origin)
	return false
}
