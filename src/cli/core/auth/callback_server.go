package auth

import (
	"bytes"
	"context"
	"crypto/subtle"
	"embed"
	"fmt"
	"html/template"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"
)

const callbackShutdownTimeout = 5 * time.Second

var (
	//go:embed templates/*.html
	templateFS embed.FS

	callbackPorts = []int{9876, 9877, 9878}

	successHTML          = mustReadTemplate("templates/success.html")
	alreadyProcessedHTML = mustReadTemplate("templates/already_processed.html")
	errorTemplate        = template.Must(template.ParseFS(templateFS, "templates/error.html"))
)

type (
	// CallbackResult holds the result of the IdP redirect callback.
	CallbackResult struct {
		Code             string
		Error            string
		ErrorDescription string
	}

	// CallbackServer is a temporary localhost HTTP server that receives the IdP authorization code redirect.
	CallbackServer struct {
		port     int
		state    string
		resultCh chan CallbackResult
		server   *http.Server
		once     sync.Once
	}
)

func mustReadTemplate(name string) string {
	data, err := templateFS.ReadFile(name)
	if err != nil {
		panic(fmt.Sprintf("embedded template %s: %v", name, err))
	}
	return string(data)
}

// NewCallbackServer creates a callback server bound to 127.0.0.1 on one of the registered ports.
// It validates the state parameter using constant-time comparison and processes only the first callback.
func NewCallbackServer(ctx context.Context, state string) (*CallbackServer, error) {
	cs := &CallbackServer{
		state:    state,
		resultCh: make(chan CallbackResult, 1),
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", cs.handleCallback)

	for _, port := range callbackPorts {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		lc := net.ListenConfig{}
		listener, err := lc.Listen(ctx, "tcp", addr)
		if err != nil {
			continue
		}

		cs.port = port
		cs.server = &http.Server{
			Handler: mux,
			Addr:    addr,
		}

		go func() {
			_ = cs.server.Serve(listener)
		}()

		return cs, nil
	}

	return nil, fmt.Errorf("cannot start callback server — ports 9876-9878 are all in use")
}

// Port returns the port the callback server is listening on.
func (cs *CallbackServer) Port() int {
	return cs.port
}

// RedirectURI returns the full redirect URI for use in the authorization request.
func (cs *CallbackServer) RedirectURI() string {
	return fmt.Sprintf("http://127.0.0.1:%d/callback", cs.port)
}

// WaitForCallback blocks until a callback is received or the context is cancelled (e.g., 5 min timeout).
func (cs *CallbackServer) WaitForCallback(ctx context.Context) (CallbackResult, error) {
	select {
	case result := <-cs.resultCh:
		return result, nil
	case <-ctx.Done():
		return CallbackResult{}, fmt.Errorf("callback server timed out waiting for response")
	}
}

// Shutdown gracefully shuts down the callback server within 5 seconds.
func (cs *CallbackServer) Shutdown() error {
	slog.Info("Shutting down callback server")
	ctx, cancel := context.WithTimeout(context.Background(), callbackShutdownTimeout)
	defer cancel()
	return cs.server.Shutdown(ctx)
}

func (cs *CallbackServer) handleCallback(w http.ResponseWriter, r *http.Request) {
	// Only process the first callback
	slog.Info("Callback server received callback request")
	processed := true
	cs.once.Do(func() {
		processed = false
	})

	if processed {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(alreadyProcessedHTML))
		return
	}

	query := r.URL.Query()

	// Verify state using constant-time comparison
	receivedState := query.Get("state")
	if subtle.ConstantTimeCompare([]byte(receivedState), []byte(cs.state)) != 1 {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(renderErrorHTML("Invalid state parameter")))
		// Don't send result — this was not a legitimate callback; reset once to allow retry
		cs.once = sync.Once{}
		return
	}

	// Check for error response from IdP
	if errCode := query.Get("error"); errCode != "" {
		errDesc := query.Get("error_description")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(renderErrorHTML(errDesc)))
		cs.resultCh <- CallbackResult{
			Error:            errCode,
			ErrorDescription: errDesc,
		}
		return
	}

	// Extract authorization code
	code := query.Get("code")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(successHTML))
	cs.resultCh <- CallbackResult{Code: code}
}

func renderErrorHTML(description string) string {
	if description == "" {
		description = "An unknown error occurred during authentication."
	}
	var buf bytes.Buffer
	_ = errorTemplate.Execute(&buf, struct{ Description string }{Description: description})
	return buf.String()
}
