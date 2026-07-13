package mcpserver

import (
	"context"
	"time"

	"connectrpc.com/connect"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"google.golang.org/protobuf/types/known/timestamppb"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

// browseLocalFolderHandler returns a handler function for the fme_browse_local_folder tool.
func browseLocalFolderHandler(
	cm *ClientManager,
) func(ctx context.Context, req *mcp.CallToolRequest, input BrowseLocalInput) (*mcp.CallToolResult, LocalFolderOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input BrowseLocalInput) (*mcp.CallToolResult, LocalFolderOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, LocalFolderOutput{}, err
		}
		resp, err := client.ListFolder(ctx, connect.NewRequest(&fmev1.ListFolderRequest{Path: input.Path}))
		if err != nil {
			return nil, LocalFolderOutput{}, err
		}
		return nil, mapFsFolder(resp.Msg), nil
	}
}

// browseS3PrefixHandler returns a handler function for the fme_browse_s3_prefix tool.
func browseS3PrefixHandler(
	cm *ClientManager,
) func(ctx context.Context, req *mcp.CallToolRequest, input BrowseS3Input) (*mcp.CallToolResult, S3FolderOutput, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, input BrowseS3Input) (*mcp.CallToolResult, S3FolderOutput, error) {
		client, err := cm.Client()
		if err != nil {
			return nil, S3FolderOutput{}, err
		}
		resp, err := client.S3ListPrefix(ctx, connect.NewRequest(&s3sharedv1.S3ListPrefixRequest{
			TransferProfile: input.TransferProfile,
			Prefix:          input.Prefix,
		}))
		if err != nil {
			return nil, S3FolderOutput{}, err
		}
		return nil, mapS3Folder(resp.Msg), nil
	}
}

// mapFsFolder converts a protobuf FsFolder message to a LocalFolderOutput struct.
func mapFsFolder(folder *fmev1.FsFolder) LocalFolderOutput {
	files := make([]FileEntry, 0, len(folder.GetFiles()))
	for _, f := range folder.GetFiles() {
		files = append(files, FileEntry{
			Path:         f.GetPath(),
			Size:         f.GetSize(),
			LastModified: formatTimestamp(f.GetLastModified()),
		})
	}
	folders := folder.GetFolders()
	if folders == nil {
		folders = []string{}
	}
	return LocalFolderOutput{
		Path:    folder.GetPath(),
		Folders: folders,
		Files:   files,
	}
}

// mapS3Folder converts a protobuf S3ListPrefixResponse to an S3FolderOutput struct.
func mapS3Folder(resp *s3sharedv1.S3ListPrefixResponse) S3FolderOutput {
	objects := make([]S3ObjEntry, 0, len(resp.GetObjects()))
	for _, obj := range resp.GetObjects() {
		objects = append(objects, S3ObjEntry{
			Key:          obj.GetKey(),
			Size:         obj.GetSize(),
			LastModified: formatTimestamp(obj.GetLastModified()),
			StorageClass: obj.GetStorageClass(),
		})
	}
	prefixes := resp.GetPrefixes()
	if prefixes == nil {
		prefixes = []string{}
	}
	return S3FolderOutput{
		Prefix:   resp.GetPrefix(),
		Prefixes: prefixes,
		Objects:  objects,
	}
}

// formatTimestamp converts a protobuf Timestamp to an RFC 3339 string.
func formatTimestamp(ts *timestamppb.Timestamp) string {
	if ts == nil {
		return ""
	}
	return ts.AsTime().Format(time.RFC3339)
}
