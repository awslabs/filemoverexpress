package mcpserver

import (
	"context"

	"connectrpc.com/connect"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// pauseJobHandler returns a handler function for the fme_pause_job tool.
func pauseJobHandler(
	cm *ClientManager,
) func(ctx context.Context, req *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		resp, err := client.PauseJob(ctx, connect.NewRequest(&fmev1.PauseJobRequest{JobId: input.JobID}))
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		return nil, JobActionOutput{
			JobID:   resp.Msg.GetJobId(),
			Success: true,
		}, nil
	}
}

// resumeJobHandler returns a handler function for the fme_resume_job tool.
func resumeJobHandler(
	cm *ClientManager,
) func(ctx context.Context, req *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		resp, err := client.ResumeJob(ctx, connect.NewRequest(&fmev1.ResumeJobRequest{JobId: input.JobID}))
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		return nil, JobActionOutput{
			JobID:   resp.Msg.GetJobId(),
			Success: true,
		}, nil
	}
}

// cancelJobHandler returns a handler function for the fme_cancel_job tool.
func cancelJobHandler(
	cm *ClientManager,
) func(ctx context.Context, req *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input JobIDInput) (*mcp.CallToolResult, JobActionOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		resp, err := client.CancelJob(ctx, connect.NewRequest(&fmev1.CancelJobRequest{JobId: input.JobID}))
		if err != nil {
			return nil, JobActionOutput{}, err
		}
		return nil, JobActionOutput{
			JobID:   resp.Msg.GetJobId(),
			Success: true,
		}, nil
	}
}
