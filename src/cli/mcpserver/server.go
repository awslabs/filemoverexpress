package mcpserver

import (
	"context"
	"fmt"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Run initializes the MCP server and blocks on the selected transport.
func Run(transport string, httpPort uint, httpAddress string) error {
	cm := NewClientManager()
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "filemoverexpress",
		Version: "1.0.0",
	}, nil)
	registerTools(server, cm)

	switch transport {
	case "stdio":
		return server.Run(context.Background(), &mcp.StdioTransport{})
	case "streamable-http":
		handler := mcp.NewStreamableHTTPHandler(func(_ *http.Request) *mcp.Server {
			return server
		}, nil)
		return http.ListenAndServe(fmt.Sprintf("%s:%d", httpAddress, httpPort), handler)
	default:
		return fmt.Errorf("unsupported transport: %s (supported: stdio, streamable-http)", transport)
	}
}

// registerTools registers all 9 MCP tools on the server.
func registerTools(server *mcp.Server, cm *ClientManager) {
	mcp.AddTool(server, &mcp.Tool{Name: ToolFmeConnect, Description: DescFmeConnect}, fmeConnectHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolFmeListJobs, Description: DescFmeListJobs}, listJobsHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolBrowseLocalFolder, Description: DescBrowseLocalFolder}, browseLocalFolderHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolBrowseS3Prefix, Description: DescBrowseS3Prefix}, browseS3PrefixHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolStartUpload, Description: DescStartUpload}, startUploadHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolStartDownload, Description: DescStartDownload}, startDownloadHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolPauseJob, Description: DescPauseJob}, pauseJobHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolResumeJob, Description: DescResumeJob}, resumeJobHandler(cm))
	mcp.AddTool(server, &mcp.Tool{Name: ToolCancelJob, Description: DescCancelJob}, cancelJobHandler(cm))
}
