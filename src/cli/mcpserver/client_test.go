package mcpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
)

// --- originOnlyInterceptor tests ---

func TestOriginOnlyInterceptor_WrapUnary_SetsOriginHeader(t *testing.T) {
	interceptor := newOriginOnlyInterceptor()

	var capturedHeaders http.Header
	mockNext := connect.UnaryFunc(func(_ context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		capturedHeaders = req.Header().Clone()
		return nil, nil
	})

	wrapped := interceptor.WrapUnary(mockNext)
	req := connect.NewRequest(&fmev1.ListJobsRequest{})
	_, _ = wrapped(context.Background(), req)

	assert.Equal(t, OriginHeaderValue, capturedHeaders.Get(OriginHeaderKey))
}

func TestOriginOnlyInterceptor_WrapUnary_DoesNotSetAuthHeader(t *testing.T) {
	interceptor := newOriginOnlyInterceptor()

	var capturedHeaders http.Header
	mockNext := connect.UnaryFunc(func(_ context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		capturedHeaders = req.Header().Clone()
		return nil, nil
	})

	wrapped := interceptor.WrapUnary(mockNext)
	req := connect.NewRequest(&fmev1.ListJobsRequest{})
	_, _ = wrapped(context.Background(), req)

	assert.Empty(t, capturedHeaders.Get(AuthHeaderKey))
}

func TestOriginOnlyInterceptor_WrapStreamingHandler_IsNoOp(t *testing.T) {
	interceptor := newOriginOnlyInterceptor()

	sentinel := connect.StreamingHandlerFunc(func(_ context.Context, _ connect.StreamingHandlerConn) error {
		return nil
	})

	wrapped := interceptor.WrapStreamingHandler(sentinel)

	// A no-op WrapStreamingHandler returns the same function pointer.
	// We verify by calling both and checking behaviour is identical (both return nil).
	// Since Go doesn't allow direct func comparison, we assert the returned func is usable
	// and produces the same result as the input.
	err := wrapped(context.Background(), nil)
	assert.NoError(t, err)
}

// --- pskInterceptor tests ---

func TestPSKInterceptor_WrapUnary_SetsOriginHeader(t *testing.T) {
	interceptor := newPSKInterceptor("test-secret-key")

	var capturedHeaders http.Header
	mockNext := connect.UnaryFunc(func(_ context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		capturedHeaders = req.Header().Clone()
		return nil, nil
	})

	wrapped := interceptor.WrapUnary(mockNext)
	req := connect.NewRequest(&fmev1.ListJobsRequest{})
	_, _ = wrapped(context.Background(), req)

	assert.Equal(t, OriginHeaderValue, capturedHeaders.Get(OriginHeaderKey))
}

func TestPSKInterceptor_WrapUnary_SetsAuthHeader(t *testing.T) {
	const authKey = "my-secret-auth-key"
	interceptor := newPSKInterceptor(authKey)

	var capturedHeaders http.Header
	mockNext := connect.UnaryFunc(func(_ context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
		capturedHeaders = req.Header().Clone()
		return nil, nil
	})

	wrapped := interceptor.WrapUnary(mockNext)
	req := connect.NewRequest(&fmev1.ListJobsRequest{})
	_, _ = wrapped(context.Background(), req)

	assert.Equal(t, authKey, capturedHeaders.Get(AuthHeaderKey))
}

func TestPSKInterceptor_WrapStreamingHandler_IsNoOp(t *testing.T) {
	interceptor := newPSKInterceptor("key")

	sentinel := connect.StreamingHandlerFunc(func(_ context.Context, _ connect.StreamingHandlerConn) error {
		return nil
	})

	wrapped := interceptor.WrapStreamingHandler(sentinel)

	err := wrapped(context.Background(), nil)
	assert.NoError(t, err)
}

// --- isLocalAddress tests ---

func TestIsLocalAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{"IPv4 loopback", "http://127.0.0.1:50006", true},
		{"localhost hostname", "http://localhost:50006", true},
		{"IPv6 loopback", "http://[::1]:50006", true},
		{"remote IP", "http://192.168.1.100:50006", false},
		{"remote hostname", "http://myserver.example.com:50006", false},
		{"remote AWS hostname", "http://ec2-1-2-3-4.compute.amazonaws.com:50006", false},
		{"empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isLocalAddress(tt.address)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// --- ClientManager tests ---

func TestConnect_LocalAddress_NoAuthRequired(t *testing.T) {
	// Start a mock daemon that responds to ListJobs
	server := startMockDaemon(t)
	defer server.Close()

	cm := &ClientManager{}
	output := cm.Connect(server.URL, "")

	assert.Equal(t, "connected", output.Status)
	assert.Equal(t, server.URL, output.Address)
}

func TestConnect_RemoteAddress_WithoutAuthKey_ReturnsError(t *testing.T) {
	cm := &ClientManager{}
	output := cm.Connect("http://192.168.1.100:50006", "")

	assert.Equal(t, "error", output.Status)
	assert.Equal(t, "http://192.168.1.100:50006", output.Address)
	assert.Equal(t, ErrRemoteAuthRequired, output.Message)

	// Verify no client was created and status is not "connected"
	_, err := cm.Client()
	assert.Error(t, err)
}

func TestConnect_RemoteAddress_AuthEnforcement(t *testing.T) {
	// Verify that the auth enforcement logic works correctly:
	// Remote without key = immediate error, no client created
	cm := &ClientManager{}

	// First attempt without key should fail immediately
	output := cm.Connect("http://remote-daemon.example.com:50006", "")
	assert.Equal(t, "error", output.Status)
	assert.Contains(t, output.Message, "auth_key")

	// Verify status is not "connected" or "retrying" - no connection attempt was made
	status := cm.Status()
	assert.NotEqual(t, "connected", status)
	assert.NotEqual(t, "retrying", status)
}

func TestClient_ReturnsError_WhenNotConnected(t *testing.T) {
	cm := &ClientManager{}

	client, err := cm.Client()
	assert.Nil(t, client)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not connected")
}

func TestClient_ReturnsClient_WhenConnected(t *testing.T) {
	server := startMockDaemon(t)
	defer server.Close()

	cm := &ClientManager{}
	cm.Connect(server.URL, "")

	client, err := cm.Client()
	assert.NoError(t, err)
	assert.NotNil(t, client)
}

func TestConnect_CancelsPreviousRetryLoop(t *testing.T) {
	// Connect to an unreachable address to start a retry loop
	cm := &ClientManager{}
	output := cm.Connect("http://127.0.0.1:19999", "") // unreachable port
	assert.Equal(t, "retrying", output.Status)

	// Verify the cancel function is set (retry loop is running)
	cm.mu.RLock()
	assert.NotNil(t, cm.cancel)
	cm.mu.RUnlock()

	// Now connect to a real mock daemon - this should cancel the previous retry
	server := startMockDaemon(t)
	defer server.Close()

	output = cm.Connect(server.URL, "")
	assert.Equal(t, "connected", output.Status)
	assert.Equal(t, server.URL, output.Address)

	// Verify the cancel is nil (no retry loop active since we connected successfully)
	cm.mu.RLock()
	assert.Nil(t, cm.cancel)
	cm.mu.RUnlock()
}

func TestStatus_ReturnsCurrentStatus(t *testing.T) {
	server := startMockDaemon(t)
	defer server.Close()

	cm := &ClientManager{}
	assert.Equal(t, "", cm.Status())

	cm.Connect(server.URL, "")
	assert.Equal(t, "connected", cm.Status())
}

func TestConnect_ReturnsRetrying_WhenDaemonUnreachable(t *testing.T) {
	cm := &ClientManager{}
	output := cm.Connect("http://127.0.0.1:19999", "")

	assert.Equal(t, "retrying", output.Status)
	assert.Contains(t, output.Message, "retrying")
}

// --- Test helpers ---

// startMockDaemon creates an httptest server that responds to the ListJobs RPC
// with a successful empty response. This mimics a running FME daemon.
func startMockDaemon(t *testing.T) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()
	mux.Handle(fmev1connect.FmeServiceListJobsProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceListJobsProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.ListJobsRequest]) (*connect.Response[fmev1.ListJobsResponse], error) {
			return connect.NewResponse(&fmev1.ListJobsResponse{}), nil
		},
	))

	return httptest.NewServer(mux)
}
