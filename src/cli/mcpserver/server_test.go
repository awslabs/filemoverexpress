package mcpserver

import (
	"context"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRun_UnsupportedTransport_Websocket validates that Run returns an error
// immediately when given "websocket" as the transport value, and the error
// message includes the unsupported value and lists supported transports.
// **Validates: Requirements 2.4, 2.5**
func TestRun_UnsupportedTransport_Websocket(t *testing.T) {
	err := Run("websocket", 8080)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported transport")
	assert.Contains(t, err.Error(), "websocket")
	assert.Contains(t, err.Error(), "stdio")
	assert.Contains(t, err.Error(), "streamable-http")
}

// TestRun_UnsupportedTransport_EmptyString validates that Run returns an error
// when transport is an empty string.
// **Validates: Requirements 2.4, 2.5**
func TestRun_UnsupportedTransport_EmptyString(t *testing.T) {
	err := Run("", 8080)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported transport")
}

// TestRegisterTools_Registers9Tools validates that registerTools registers
// exactly 9 tools on the MCP server by connecting an in-memory client and
// listing the available tools.
// **Validates: Requirements 7.1**
func TestRegisterTools_Registers9Tools(t *testing.T) {
	server := mcp.NewServer(&mcp.Implementation{Name: "test", Version: "v0.0.1"}, nil)
	cm := &ClientManager{} // empty manager, just for registration
	registerTools(server, cm)

	// Connect a client to verify tools are registered
	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "v0.0.1"}, nil)
	t1, t2 := mcp.NewInMemoryTransports()

	// Server must connect before client
	_, err := server.Connect(context.Background(), t1, nil)
	require.NoError(t, err)

	session, err := client.Connect(context.Background(), t2, nil)
	require.NoError(t, err)
	defer session.Close()

	// List tools via the iterator
	var tools []*mcp.Tool
	for tool, err := range session.Tools(context.Background(), nil) {
		require.NoError(t, err)
		tools = append(tools, tool)
	}
	assert.Len(t, tools, 9)
}
