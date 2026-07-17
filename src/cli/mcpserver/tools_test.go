package mcpserver

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
	s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// mockDaemonConfig controls what the mock daemon returns for each RPC.
type mockDaemonConfig struct {
	jobs         []*fmev1.Job
	folder       *fmev1.FsFolder
	s3Response   *s3sharedv1.S3ListPrefixResponse
	uploadResp   *s3sharedv1.UploadPrefixResponse
	downloadResp *s3sharedv1.DownloadPrefixesResponse
	pauseResp    *fmev1.PauseJobResponse
	resumeResp   *fmev1.ResumeJobResponse
	cancelResp   *fmev1.CancelJobResponse
	// returnErr causes all non-ListJobs handlers to return this error.
	// ListJobs always succeeds (to allow ClientManager validation) unless listJobsErr is set.
	returnErr   error
	listJobsErr error
}

// startFullMockDaemon creates an httptest server that implements all RPC endpoints
// used by the MCP tool handlers.
func startFullMockDaemon(t *testing.T, cfg mockDaemonConfig) *httptest.Server {
	t.Helper()

	mux := http.NewServeMux()

	mux.Handle(fmev1connect.FmeServiceListJobsProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceListJobsProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.ListJobsRequest]) (*connect.Response[fmev1.ListJobsResponse], error) {
			if cfg.listJobsErr != nil {
				return nil, cfg.listJobsErr
			}
			return connect.NewResponse(&fmev1.ListJobsResponse{Jobs: cfg.jobs}), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceListFolderProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceListFolderProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.ListFolderRequest]) (*connect.Response[fmev1.FsFolder], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.folder), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceS3ListPrefixProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceS3ListPrefixProcedure,
		func(_ context.Context, _ *connect.Request[s3sharedv1.S3ListPrefixRequest]) (*connect.Response[s3sharedv1.S3ListPrefixResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.s3Response), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceUploadPrefixesProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceUploadPrefixesProcedure,
		func(_ context.Context, _ *connect.Request[s3sharedv1.UploadPrefixRequest]) (*connect.Response[s3sharedv1.UploadPrefixResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.uploadResp), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceDownloadPrefixesProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceDownloadPrefixesProcedure,
		func(_ context.Context, _ *connect.Request[s3sharedv1.DownloadPrefixesRequest]) (*connect.Response[s3sharedv1.DownloadPrefixesResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.downloadResp), nil
		},
	))

	mux.Handle(fmev1connect.FmeServicePauseJobProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServicePauseJobProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.PauseJobRequest]) (*connect.Response[fmev1.PauseJobResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.pauseResp), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceResumeJobProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceResumeJobProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.ResumeJobRequest]) (*connect.Response[fmev1.ResumeJobResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.resumeResp), nil
		},
	))

	mux.Handle(fmev1connect.FmeServiceCancelJobProcedure, connect.NewUnaryHandler(
		fmev1connect.FmeServiceCancelJobProcedure,
		func(_ context.Context, _ *connect.Request[fmev1.CancelJobRequest]) (*connect.Response[fmev1.CancelJobResponse], error) {
			if cfg.returnErr != nil {
				return nil, cfg.returnErr
			}
			return connect.NewResponse(cfg.cancelResp), nil
		},
	))

	return httptest.NewServer(mux)
}

// connectedManager creates a ClientManager connected to the given test server.
func connectedManager(t *testing.T, server *httptest.Server) *ClientManager {
	t.Helper()
	cm := &ClientManager{}
	output := cm.Connect(server.URL, "")
	require.Equal(t, "connected", output.Status)
	return cm
}

// --- ListJobs handler tests ---

func TestListJobsHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		jobs: []*fmev1.Job{
			{
				JobId:               "job-1",
				Name:                "Upload Media",
				Status:              "transferring",
				Direction:           "upload",
				TransferProfileName: "prod-profile",
				TotalBytes:          1024000,
				BytesUploaded:       512000,
				BytesDownloaded:     0,
				Destination:         "s3://my-bucket/prefix/",
				Bucket:              "my-bucket",
				HasTaskErrors:       false,
			},
			{
				JobId:               "job-2",
				Name:                "Download Assets",
				Status:              "completed",
				Direction:           "download",
				TransferProfileName: "dev-profile",
				TotalBytes:          2048000,
				BytesUploaded:       0,
				BytesDownloaded:     2048000,
				Destination:         "/tmp/downloads",
				Bucket:              "assets-bucket",
				HasTaskErrors:       true,
			},
		},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := listJobsHandler(cm)
	_, output, err := handler(context.Background(), nil, ListJobsInput{})

	require.NoError(t, err)
	require.Len(t, output.Jobs, 2)

	assert.Equal(t, "job-1", output.Jobs[0].JobID)
	assert.Equal(t, "Upload Media", output.Jobs[0].Name)
	assert.Equal(t, "transferring", output.Jobs[0].Status)
	assert.Equal(t, "upload", output.Jobs[0].Direction)
	assert.Equal(t, "prod-profile", output.Jobs[0].TransferProfile)
	assert.Equal(t, int64(1024000), output.Jobs[0].TotalBytes)
	assert.Equal(t, int64(512000), output.Jobs[0].BytesUploaded)
	assert.Equal(t, int64(0), output.Jobs[0].BytesDownloaded)
	assert.Equal(t, "s3://my-bucket/prefix/", output.Jobs[0].Destination)
	assert.Equal(t, "my-bucket", output.Jobs[0].Bucket)
	assert.False(t, output.Jobs[0].HasTaskErrors)

	assert.Equal(t, "job-2", output.Jobs[1].JobID)
	assert.Equal(t, "Download Assets", output.Jobs[1].Name)
	assert.True(t, output.Jobs[1].HasTaskErrors)
}

func TestListJobsHandler_EmptyJobs(t *testing.T) {
	cfg := mockDaemonConfig{jobs: []*fmev1.Job{}}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := listJobsHandler(cm)
	_, output, err := handler(context.Background(), nil, ListJobsInput{})

	require.NoError(t, err)
	assert.NotNil(t, output.Jobs)
	assert.Empty(t, output.Jobs)
}

func TestListJobsHandler_NotConnected(t *testing.T) {
	cm := &ClientManager{}
	handler := listJobsHandler(cm)
	_, _, err := handler(context.Background(), nil, ListJobsInput{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not connected")
}

func TestListJobsHandler_RPCError(t *testing.T) {
	cfg := mockDaemonConfig{listJobsErr: errors.New("internal server error")}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	// Directly set client state since we're in the same package.
	cm := &ClientManager{}
	cm.client = fmev1connect.NewFmeServiceClient(http.DefaultClient, server.URL, connect.WithInterceptors(newOriginOnlyInterceptor()))
	cm.status = "connected"
	cm.address = server.URL

	handler := listJobsHandler(cm)
	_, _, err := handler(context.Background(), nil, ListJobsInput{})

	assert.Error(t, err)
}

// --- BrowseLocalFolder handler tests ---

func TestBrowseLocalFolderHandler_Success(t *testing.T) {
	ts := timestamppb.New(time.Date(2024, 6, 15, 10, 30, 0, 0, time.UTC))
	cfg := mockDaemonConfig{
		folder: &fmev1.FsFolder{
			Path:    "/data/media",
			Folders: []string{"/data/media/videos", "/data/media/images"},
			Files: []*fmev1.FsFile{
				{Path: "/data/media/file1.mov", Size: 4096, LastModified: ts},
				{Path: "/data/media/file2.jpg", Size: 2048, LastModified: ts},
			},
		},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := browseLocalFolderHandler(cm)
	_, output, err := handler(context.Background(), nil, BrowseLocalInput{Path: "/data/media"})

	require.NoError(t, err)
	assert.Equal(t, "/data/media", output.Path)
	assert.Equal(t, []string{"/data/media/videos", "/data/media/images"}, output.Folders)
	require.Len(t, output.Files, 2)
	assert.Equal(t, "/data/media/file1.mov", output.Files[0].Path)
	assert.Equal(t, int64(4096), output.Files[0].Size)
	assert.Equal(t, ts.AsTime().Format(time.RFC3339), output.Files[0].LastModified)
	assert.Equal(t, "/data/media/file2.jpg", output.Files[1].Path)
	assert.Equal(t, int64(2048), output.Files[1].Size)
}

func TestBrowseLocalFolderHandler_RPCError(t *testing.T) {
	cfg := mockDaemonConfig{returnErr: errors.New("permission denied")}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := browseLocalFolderHandler(cm)
	_, _, err := handler(context.Background(), nil, BrowseLocalInput{Path: "/restricted"})

	assert.Error(t, err)
}

// --- BrowseS3Prefix handler tests ---

func TestBrowseS3PrefixHandler_Success(t *testing.T) {
	ts := timestamppb.New(time.Date(2024, 3, 20, 8, 0, 0, 0, time.UTC))
	cfg := mockDaemonConfig{
		s3Response: &s3sharedv1.S3ListPrefixResponse{
			Prefix:   "media/",
			Prefixes: []string{"media/videos/", "media/images/"},
			Objects: []*s3sharedv1.S3Object{
				{Key: "media/readme.txt", Size: 256, LastModified: ts, StorageClass: "STANDARD"},
				{Key: "media/data.csv", Size: 10240, LastModified: ts, StorageClass: "INTELLIGENT_TIERING"},
			},
		},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := browseS3PrefixHandler(cm)
	_, output, err := handler(context.Background(), nil, BrowseS3Input{
		TransferProfile: "prod-profile",
		Prefix:          "media/",
	})

	require.NoError(t, err)
	assert.Equal(t, "media/", output.Prefix)
	assert.Equal(t, []string{"media/videos/", "media/images/"}, output.Prefixes)
	require.Len(t, output.Objects, 2)
	assert.Equal(t, "media/readme.txt", output.Objects[0].Key)
	assert.Equal(t, int64(256), output.Objects[0].Size)
	assert.Equal(t, ts.AsTime().Format(time.RFC3339), output.Objects[0].LastModified)
	assert.Equal(t, "STANDARD", output.Objects[0].StorageClass)
	assert.Equal(t, "media/data.csv", output.Objects[1].Key)
	assert.Equal(t, "INTELLIGENT_TIERING", output.Objects[1].StorageClass)
}

// --- StartUpload handler tests ---

func TestStartUploadHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		uploadResp: &s3sharedv1.UploadPrefixResponse{
			Success: true,
			JobId:   "upload-job-123",
			Status:  s3sharedv1.UploadPrefixStatusCode_UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_SUCCESS,
		},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := startUploadHandler(cm)
	_, output, err := handler(context.Background(), nil, StartUploadInput{
		TransferProfile: "prod-profile",
		Prefixes:        []string{"/data/media/file1.mov"},
		Destination:     "s3://my-bucket/uploads/",
		BasePath:        "/data/media",
		JobName:         "My Upload",
		Force:           true,
	})

	require.NoError(t, err)
	assert.True(t, output.Success)
	assert.Equal(t, "upload-job-123", output.JobID)
	assert.Equal(t, "UPLOAD_PREFIX_STATUS_CODE_QUEUED_UPLOAD_SUCCESS", output.Status)
}

func TestStartUploadHandler_NotConnected(t *testing.T) {
	cm := &ClientManager{}
	handler := startUploadHandler(cm)
	_, _, err := handler(context.Background(), nil, StartUploadInput{
		TransferProfile: "profile",
		Prefixes:        []string{"/tmp/file"},
		Destination:     "s3://bucket/prefix/",
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not connected")
}

// --- StartDownload handler tests ---

func TestStartDownloadHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		downloadResp: &s3sharedv1.DownloadPrefixesResponse{
			StatusCode: s3sharedv1.S3DownloadPathStatusCode_S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_SUCCESS,
			JobId:      "download-job-456",
		},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := startDownloadHandler(cm)
	_, output, err := handler(context.Background(), nil, StartDownloadInput{
		TransferProfile: "dev-profile",
		Prefixes:        []string{"media/videos/clip.mp4"},
		Destination:     "/tmp/downloads",
		JobName:         "My Download",
		Force:           false,
	})

	require.NoError(t, err)
	assert.Equal(t, "S3_DOWNLOAD_PATH_STATUS_CODE_QUEUED_DOWNLOAD_SUCCESS", output.StatusCode)
	assert.Equal(t, "download-job-456", output.JobID)
}

// --- PauseJob handler tests ---

func TestPauseJobHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		pauseResp: &fmev1.PauseJobResponse{JobId: "job-abc", Success: true},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := pauseJobHandler(cm)
	_, output, err := handler(context.Background(), nil, JobIDInput{JobID: "job-abc"})

	require.NoError(t, err)
	assert.Equal(t, "job-abc", output.JobID)
	assert.True(t, output.Success)
}

func TestPauseJobHandler_RPCError(t *testing.T) {
	cfg := mockDaemonConfig{returnErr: errors.New("job not found")}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := pauseJobHandler(cm)
	_, _, err := handler(context.Background(), nil, JobIDInput{JobID: "nonexistent"})

	assert.Error(t, err)
}

// --- ResumeJob handler tests ---

func TestResumeJobHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		resumeResp: &fmev1.ResumeJobResponse{JobId: "job-def", Success: true},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := resumeJobHandler(cm)
	_, output, err := handler(context.Background(), nil, JobIDInput{JobID: "job-def"})

	require.NoError(t, err)
	assert.Equal(t, "job-def", output.JobID)
	assert.True(t, output.Success)
}

// --- CancelJob handler tests ---

func TestCancelJobHandler_Success(t *testing.T) {
	cfg := mockDaemonConfig{
		cancelResp: &fmev1.CancelJobResponse{JobId: "job-ghi", Success: true},
	}
	server := startFullMockDaemon(t, cfg)
	defer server.Close()

	cm := connectedManager(t, server)
	handler := cancelJobHandler(cm)
	_, output, err := handler(context.Background(), nil, JobIDInput{JobID: "job-ghi"})

	require.NoError(t, err)
	assert.Equal(t, "job-ghi", output.JobID)
	assert.True(t, output.Success)
}

// --- FmeConnect handler tests ---

func TestFmeConnectHandler_DefaultAddress(t *testing.T) {
	cm := &ClientManager{}
	handler := fmeConnectHandler(cm)

	// With empty address, the handler defaults to DefaultDaemonAddr.
	_, output, err := handler(context.Background(), nil, FmeConnectInput{Address: ""})

	// The connect handler returns error only for "error" status (auth issue).
	// For unreachable daemon, status is "retrying" which is not an error from the handler's perspective.
	if err == nil {
		assert.Equal(t, DefaultDaemonAddr, output.Address)
	} else {
		// In case the system has something running on DefaultDaemonAddr that rejects the connection
		assert.Equal(t, DefaultDaemonAddr, output.Address)
	}
}

func TestFmeConnectHandler_RemoteWithoutAuth(t *testing.T) {
	cm := &ClientManager{}
	handler := fmeConnectHandler(cm)

	_, output, err := handler(context.Background(), nil, FmeConnectInput{
		Address: "http://192.168.1.100:50006",
		AuthKey: "",
	})

	assert.Error(t, err)
	assert.Equal(t, "error", output.Status)
	assert.Equal(t, ErrRemoteAuthRequired, output.Message)
}

// --- Run function tests ---

func TestRun_UnsupportedTransport(t *testing.T) {
	err := Run("invalid-transport", 8080, "127.0.0.1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported transport")
	assert.Contains(t, err.Error(), "invalid-transport")
}
