package mcpserver

import (
	"context"

	"connectrpc.com/connect"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// listJobsHandler returns a handler function for the fme_list_jobs tool.
func listJobsHandler(cm *ClientManager) func(ctx context.Context, req *mcp.CallToolRequest, input ListJobsInput) (*mcp.CallToolResult, ListJobsOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, _ ListJobsInput) (*mcp.CallToolResult, ListJobsOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, ListJobsOutput{}, err
		}
		resp, err := client.ListJobs(ctx, connect.NewRequest(&fmev1.ListJobsRequest{}))
		if err != nil {
			return nil, ListJobsOutput{}, err
		}
		return nil, ListJobsOutput{Jobs: mapJobs(resp.Msg.GetJobs())}, nil
	}
}

// mapJobs converts protobuf Job messages to JobOutput structs.
func mapJobs(jobs []*fmev1.Job) []JobOutput {
	if len(jobs) == 0 {
		return []JobOutput{}
	}
	result := make([]JobOutput, len(jobs))
	for i, j := range jobs {
		result[i] = JobOutput{
			JobID:           j.GetJobId(),
			Name:            j.GetName(),
			Status:          j.GetStatus(),
			Direction:       j.GetDirection(),
			TransferProfile: j.GetTransferProfileName(),
			TotalBytes:      j.GetTotalBytes(),
			BytesUploaded:   j.GetBytesUploaded(),
			BytesDownloaded: j.GetBytesDownloaded(),
			Destination:     j.GetDestination(),
			Bucket:          j.GetBucket(),
			HasTaskErrors:   j.GetHasTaskErrors(),
		}
	}
	return result
}
