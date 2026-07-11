package mcpserver

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
)

type (
	// originOnlyInterceptor attaches the Origin header without auth (for local daemons).
	originOnlyInterceptor struct{}

	// pskInterceptor attaches Origin and x-fme-key headers (for remote daemons).
	pskInterceptor struct {
		key string
	}

	// ClientManager holds the active ConnectRPC client and manages connection state.
	ClientManager struct {
		mu      sync.RWMutex
		client  fmev1connect.FmeServiceClient
		status  string // "connected", "retrying", "disconnected"
		address string
		authKey string
		cancel  context.CancelFunc
	}
)

func newOriginOnlyInterceptor() *originOnlyInterceptor {
	return &originOnlyInterceptor{}
}

func (*originOnlyInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		req.Header().Set(OriginHeaderKey, OriginHeaderValue)
		return next(ctx, req)
	}
}

func (*originOnlyInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)
		conn.RequestHeader().Set(OriginHeaderKey, OriginHeaderValue)
		return conn
	}
}

func (*originOnlyInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

func newPSKInterceptor(key string) *pskInterceptor {
	return &pskInterceptor{key: key}
}

func (i *pskInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
	return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		req.Header().Set(OriginHeaderKey, OriginHeaderValue)
		req.Header().Set(AuthHeaderKey, i.key)
		return next(ctx, req)
	}
}

func (i *pskInterceptor) WrapStreamingClient(next connect.StreamingClientFunc) connect.StreamingClientFunc {
	return func(ctx context.Context, spec connect.Spec) connect.StreamingClientConn {
		conn := next(ctx, spec)
		conn.RequestHeader().Set(OriginHeaderKey, OriginHeaderValue)
		conn.RequestHeader().Set(AuthHeaderKey, i.key)
		return conn
	}
}

func (*pskInterceptor) WrapStreamingHandler(next connect.StreamingHandlerFunc) connect.StreamingHandlerFunc {
	return next
}

// NewClientManager creates a manager and auto-connects to the default address.
func NewClientManager() *ClientManager {
	cm := &ClientManager{}
	cm.Connect(DefaultDaemonAddr, "")
	return cm
}

// Connect sets target address and initiates connection with retry.
// Returns output describing connection status.
func (cm *ClientManager) Connect(address, authKey string) FmeConnectOutput {
	if address == "" {
		address = DefaultDaemonAddr
	}

	if !isLocalAddress(address) && authKey == "" {
		return FmeConnectOutput{Address: address, Status: "error", Message: ErrRemoteAuthRequired}
	}

	cm.mu.Lock()
	if cm.cancel != nil {
		cm.cancel()
	}
	cm.address = address
	cm.authKey = authKey

	var interceptor connect.Interceptor
	if isLocalAddress(address) {
		interceptor = newOriginOnlyInterceptor()
	} else {
		interceptor = newPSKInterceptor(authKey)
	}
	cm.client = fmev1connect.NewFmeServiceClient(
		http.DefaultClient,
		address,
		connect.WithInterceptors(interceptor),
	)
	cm.mu.Unlock()

	if cm.validate() {
		cm.mu.Lock()
		cm.status = "connected"
		cm.cancel = nil
		cm.mu.Unlock()
		return FmeConnectOutput{Address: address, Status: "connected", Message: "connected to " + address}
	}

	ctx, cancel := context.WithCancel(context.Background())
	cm.mu.Lock()
	cm.cancel = cancel
	cm.status = "retrying"
	cm.mu.Unlock()
	go cm.retryLoop(ctx)

	return FmeConnectOutput{
		Address: address,
		Status:  "retrying",
		Message: fmt.Sprintf(MsgRetrying, RetryIntervalSec),
	}
}

// validate performs a ListJobs ping with a 5-second timeout.
func (cm *ClientManager) validate() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cm.mu.RLock()
	client := cm.client
	cm.mu.RUnlock()

	if client == nil {
		return false
	}

	_, err := client.ListJobs(ctx, connect.NewRequest(&fmev1.ListJobsRequest{}))
	return err == nil
}

// retryLoop attempts reconnection every RetryIntervalSec seconds until success or cancellation.
func (cm *ClientManager) retryLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(RetryIntervalSec) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if cm.validate() {
				cm.mu.Lock()
				cm.status = "connected"
				cm.cancel = nil
				cm.mu.Unlock()
				return
			}
		}
	}
}

// Client returns the active client or an error if not connected.
func (cm *ClientManager) Client() (fmev1connect.FmeServiceClient, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	if cm.status != "connected" {
		return nil, fmt.Errorf(ErrNotConnected, cm.address, cm.status)
	}
	return cm.client, nil
}

// Status returns the current connection status string.
func (cm *ClientManager) Status() string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.status
}

// isLocalAddress returns true if the address is a localhost address.
func isLocalAddress(address string) bool {
	return strings.Contains(address, "127.0.0.1") ||
		strings.Contains(address, "localhost") ||
		strings.Contains(address, "[::1]")
}
