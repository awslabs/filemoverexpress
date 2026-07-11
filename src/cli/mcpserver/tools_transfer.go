package mcpserver

import (
	"context"

	"connectrpc.com/connect"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

// startUploadHandler returns a handler function for the fme_start_upload tool.
// It constructs an UploadPrefixRequest and calls the UploadPrefixes RPC,
// forwarding optional parameters (base_path, job_name, force) when provided.
func startUploadHandler(cm *ClientManager) func(ctx context.Context, req *mcp.CallToolRequest, input StartUploadInput) (*mcp.CallToolResult, StartUploadOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input StartUploadInput) (*mcp.CallToolResult, StartUploadOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, StartUploadOutput{}, err
		}
		req := &s3sharedv1.UploadPrefixRequest{
			TransferProfile: input.TransferProfile,
			Prefixes:        input.Prefixes,
			Destination:     input.Destination,
			BasePath:        input.BasePath,
			JobName:         input.JobName,
			Force:           input.Force,
		}
		resp, err := client.UploadPrefixes(ctx, connect.NewRequest(req))
		if err != nil {
			return nil, StartUploadOutput{}, err
		}
		return nil, StartUploadOutput{
			Success: resp.Msg.GetSuccess(),
			JobID:   resp.Msg.GetJobId(),
			Status:  resp.Msg.GetStatus().String(),
		}, nil
	}
}

// startDownloadHandler returns a handler function for the fme_start_download tool.
// It constructs a DownloadPrefixesRequest and calls the DownloadPrefixes RPC,
// forwarding optional parameters (job_name, force) when provided.
func startDownloadHandler(cm *ClientManager) func(ctx context.Context, req *mcp.CallToolRequest, input StartDownloadInput) (*mcp.CallToolResult, StartDownloadOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input StartDownloadInput) (*mcp.CallToolResult, StartDownloadOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, StartDownloadOutput{}, err
		}
		req := &s3sharedv1.DownloadPrefixesRequest{
			TransferProfile: input.TransferProfile,
			Prefixes:        input.Prefixes,
			Destination:     input.Destination,
			JobName:         input.JobName,
			Force:           input.Force,
		}
		resp, err := client.DownloadPrefixes(ctx, connect.NewRequest(req))
		if err != nil {
			return nil, StartDownloadOutput{}, err
		}
		return nil, StartDownloadOutput{
			StatusCode: resp.Msg.GetStatusCode().String(),
			JobID:      resp.Msg.GetJobId(),
		}, nil
	}
}
