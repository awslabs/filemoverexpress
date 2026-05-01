package service

import (
	"context"
	"path/filepath"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/service/serviceutils"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/fs/fsbrowser"
)

func (*FileMoverServer) DeleteLocalPath(
	_ context.Context,
	req *connect.Request[fmev1.DeleteLocalPathRequest],
) (*connect.Response[fmev1.DeleteLocalPathResponse], error) {
	resp := &fmev1.DeleteLocalPathResponse{
		Success: false,
		Message: "",
	}

	cfg := config.LoadConfiguration()
	allowLocalRenameDelete := cfg.APIServer.Permissions.AllowLocalRenameDelete
	if !isLocalClient(req.Peer()) && !allowLocalRenameDelete {
		resp.Success = false
		resp.Message = strLocalDeleteNotAllowed
		return connect.NewResponse(resp), nil
	}

	cleanedPathToDelete := filepath.Clean(serviceutils.ConvertPathFromGRPC(req.Msg.PathToDelete))

	if req.Msg.PathType == "folder" {
		err := fsbrowser.DeleteLocalPath(cleanedPathToDelete, fsbrowser.Folder)
		if err != nil {
			resp.Success = false
			resp.Message = err.Error()
			return connect.NewResponse(resp), nil
		}
	} else {
		err := fsbrowser.DeleteLocalPath(cleanedPathToDelete, fsbrowser.File)
		if err != nil {
			resp.Success = false
			resp.Message = err.Error()
			return connect.NewResponse(resp), nil
		}
	}

	resp.Success = true
	resp.Message = ""
	return connect.NewResponse(resp), nil
}
