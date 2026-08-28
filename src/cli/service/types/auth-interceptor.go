package types

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/service/auth-list"
)

// #nosec G101 -- False positives
const (
	tokenHeader          = "x-fme-key"
	maxRetries           = 10
	strUserNotAuthorized = "AUTHENTICATION_FAILED"
)

var errNoToken = errors.New("invalid or missing preshared key")

type AuthInterceptor struct {
	authList *auth_list.AuthAttemptList
	config   ServiceConfig
}

func NewAuthInterceptor(config ServiceConfig) *AuthInterceptor {
	return &AuthInterceptor{
		config: config,
		authList: auth_list.NewAuthAttemptList(auth_list.AuthAttemptListConfig{
			Cutoff:        auth_list.MinCutoff,
			BackoffFactor: auth_list.MinBackoffFactor,
			MaxTries:      maxRetries,
		}),
	}
}

func (i *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		if authErr := i.isAllowed(req.Header().Get(tokenHeader), req.Spec().Procedure, req.Peer().Addr); authErr != nil {
			return nil, authErr
		}

		return next(ctx, req)
	}
}

func (i *AuthInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)
		if authErr := i.isAllowed(conn.RequestHeader().Get(tokenHeader), conn.Spec().Procedure, conn.Peer().Addr); authErr != nil {
			if err := conn.CloseResponse(); err != nil {
				logger.Error(errNoToken.Error())
			}
		}

		return conn
	}
}

func (i *AuthInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return func(ctx context.Context, conn connect.StreamingHandlerConn) error {
		if authErr := i.isAllowed(conn.RequestHeader().Get(tokenHeader), conn.Spec().Procedure, conn.Peer().Addr); authErr != nil {
			return connect.NewError(connect.CodeUnauthenticated, authErr)
		}

		return next(ctx, conn)
	}
}

func (i *AuthInterceptor) isAllowed(header string, procedure string, remoteAddr string) error {
	events.Events.Info("New request from %s for %s", remoteAddr, procedure)

	if err := i.authList.IsBlocked(remoteAddr); err != nil {
		logger.Warn(
			"Connection attempt for %s from %s blocked due to too many authentication failures",
			procedure,
			remoteAddr,
		)
		return errors.New(strUserNotAuthorized)
	}

	if !i.config.Remote {
		return nil
	}

	if header != i.config.PreSharedKey {
		events.Events.Warn(
			"Connection attempt for %s failed due to missing or invalid credentials from %s",
			procedure,
			remoteAddr,
		)
		i.authList.Add(remoteAddr)
		return errors.New(strUserNotAuthorized)
	}

	// Successful authentication — clear any recorded failures for this client so a
	// past mistyped key never counts toward a future lockout.
	i.authList.Reset(remoteAddr)
	return nil
}
