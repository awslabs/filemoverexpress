//go:build ignore

package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/awslabs/filemoverexpress/mcpserver"
)

func main() {
	transport := flag.String("transport", "stdio", "MCP transport type (stdio, streamable-http)")
	httpPort := flag.Uint("http-port", 8080, "HTTP port for streamable-http transport")
	flag.Parse()

	if err := mcpserver.Run(*transport, *httpPort); err != nil {
		fmt.Fprintf(os.Stderr, "fme-mcp: %v\n", err)
		os.Exit(1)
	}
}
