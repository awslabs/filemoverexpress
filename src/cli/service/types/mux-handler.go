package types

import "net/http"

// ResponseHeader is a middleware handler that adds a header to the response
type ResponseHeader struct {
	handler http.Handler
}

// NewResponseHeader constructs a new ResponseHeader middleware handler
func NewResponseHeader(handlerToWrap http.Handler) *ResponseHeader {
	return &ResponseHeader{handlerToWrap}
}

// ServeHTTP handles the request by adding the response header
func (rh *ResponseHeader) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Referrer-Policy, X-Grpc-Web, X-FME-Key, X-User-Agent")
	w.Header().Set("Access-Control-Allow-Methods", "*")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Max-Age", "600")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	//call the wrapped handler
	rh.handler.ServeHTTP(w, r)
}
