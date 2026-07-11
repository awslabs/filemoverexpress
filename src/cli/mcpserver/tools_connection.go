package mcpserver

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// fmeConnectHandler returns a handler function for the fme_connect tool.
// It defaults the address to the local daemon when empty and delegates
// connection management to the ClientManager.
func fmeConnectHandler(cm *ClientManager) func(ctx context.Context, req *mcp.CallToolRequest, input FmeConnectInput) (*mcp.CallToolResult, FmeConnectOutput, error) {
	return func(_ context.Context, _ *mcp.CallToolRequest, input FmeConnectInput) (*mcp.CallToolResult, FmeConnectOutput, error) {
		if input.Address == "" {
			input.Address = DefaultDaemonAddr
		}
		output := cm.Connect(input.Address, input.AuthKey)
		if output.Status == "error" {
			return nil, output, fmt.Errorf("%s", output.Message)
		}
		return nil, output, nil
	}
}
