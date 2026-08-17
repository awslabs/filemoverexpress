package auth

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCallbackServer_SuccessfulCallback(t *testing.T) {
	state := "test-state-value-12345"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Simulate IdP redirect in a goroutine
	go func() {
		url := fmt.Sprintf("http://127.0.0.1:%d/callback?code=AUTH_CODE_123&state=%s", cs.Port(), state)
		resp, err := http.Get(url) //nolint:gosec
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	}()

	result, err := cs.WaitForCallback(ctx)
	require.NoError(t, err)
	assert.Equal(t, "AUTH_CODE_123", result.Code)
	assert.Empty(t, result.Error)
}

func TestCallbackServer_InvalidState_Rejected(t *testing.T) {
	state := "correct-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	// Send callback with wrong state
	url := fmt.Sprintf("http://127.0.0.1:%d/callback?code=SOME_CODE&state=wrong-state", cs.Port())
	resp, err := http.Get(url) //nolint:gosec
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	body, _ := io.ReadAll(resp.Body)
	assert.Contains(t, string(body), "Invalid state parameter")
}

func TestCallbackServer_ErrorFromIdP(t *testing.T) {
	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	go func() {
		url := fmt.Sprintf(
			"http://127.0.0.1:%d/callback?error=access_denied&error_description=User+denied+consent&state=%s",
			cs.Port(), state,
		)
		resp, err := http.Get(url) //nolint:gosec
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	}()

	result, err := cs.WaitForCallback(ctx)
	require.NoError(t, err)
	assert.Equal(t, "access_denied", result.Error)
	assert.Equal(t, "User denied consent", result.ErrorDescription)
	assert.Empty(t, result.Code)
}

func TestCallbackServer_Timeout(t *testing.T) {
	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err = cs.WaitForCallback(ctx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "timed out")
}

func TestCallbackServer_PortFallback(t *testing.T) {
	// Occupy the first port
	listener1, err := net.Listen("tcp", "127.0.0.1:9876")
	require.NoError(t, err)
	defer listener1.Close()

	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	// Should have fallen back to 9877 or 9878
	assert.NotEqual(t, 9876, cs.Port())
	assert.Contains(t, []int{9877, 9878}, cs.Port())
}

func TestCallbackServer_AllPortsInUse(t *testing.T) {
	// Occupy all three ports
	var listeners []net.Listener
	for _, port := range callbackPorts {
		l, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		require.NoError(t, err)
		listeners = append(listeners, l)
	}
	defer func() {
		for _, l := range listeners {
			l.Close()
		}
	}()

	_, err := NewCallbackServer(context.Background(), "state")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ports 9876-9878 are all in use")
}

func TestCallbackServer_SuccessHTML_ContainsBranding(t *testing.T) {
	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	url := fmt.Sprintf("http://127.0.0.1:%d/callback?code=CODE&state=%s", cs.Port(), state)
	resp, err := http.Get(url) //nolint:gosec
	require.NoError(t, err)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)
	assert.Contains(t, html, "File Mover Express")
	assert.Contains(t, html, "Login Successful")
	assert.Contains(t, html, "close this browser tab")
}

func TestCallbackServer_ErrorHTML_ContainsBranding(t *testing.T) {
	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	url := fmt.Sprintf(
		"http://127.0.0.1:%d/callback?error=server_error&error_description=Something+went+wrong&state=%s",
		cs.Port(), state,
	)
	resp, err := http.Get(url) //nolint:gosec
	require.NoError(t, err)
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)
	assert.Contains(t, html, "File Mover Express")
	assert.Contains(t, html, "Login Failed")
	assert.Contains(t, html, "Something went wrong")
	assert.Contains(t, html, "try again")
}

func TestCallbackServer_SecondCallback_AlreadyProcessed(t *testing.T) {
	state := "test-state"
	cs, err := NewCallbackServer(context.Background(), state)
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	// First callback — should succeed
	url := fmt.Sprintf("http://127.0.0.1:%d/callback?code=FIRST_CODE&state=%s", cs.Port(), state)
	resp1, err := http.Get(url) //nolint:gosec
	require.NoError(t, err)
	resp1.Body.Close()

	// Drain the result channel
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	result, err := cs.WaitForCallback(ctx)
	require.NoError(t, err)
	assert.Equal(t, "FIRST_CODE", result.Code)

	// Second callback — should get "already processed"
	url2 := fmt.Sprintf("http://127.0.0.1:%d/callback?code=SECOND_CODE&state=%s", cs.Port(), state)
	resp2, err := http.Get(url2) //nolint:gosec
	require.NoError(t, err)
	defer resp2.Body.Close()

	body, _ := io.ReadAll(resp2.Body)
	assert.Equal(t, http.StatusOK, resp2.StatusCode)
	assert.Contains(t, string(body), "already been processed")
}

func TestCallbackServer_RedirectURI(t *testing.T) {
	cs, err := NewCallbackServer(context.Background(), "state")
	require.NoError(t, err)
	defer func() { _ = cs.Shutdown() }()

	expected := fmt.Sprintf("http://127.0.0.1:%d/callback", cs.Port())
	assert.Equal(t, expected, cs.RedirectURI())
}
