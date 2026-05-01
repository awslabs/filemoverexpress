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

func (*FileMoverServer) RenameLocalPath(
	_ context.Context,
	req *connect.Request[fmev1.RenameLocalPathRequest],
) (*connect.Response[fmev1.RenameLocalPathResponse], error) {
	resp := &fmev1.RenameLocalPathResponse{
		Success: false,
		Message: "",
	}

	cfg := config.LoadConfiguration()
	allowLocalRenameDelete := cfg.APIServer.Permissions.AllowLocalRenameDelete
	if !isLocalClient(req.Peer()) && !allowLocalRenameDelete {
		resp.Success = false
		resp.Message = strLocalRenameNotAllowed
		return connect.NewResponse(resp), nil
	}

	cleanedPathToRename := filepath.Clean(serviceutils.ConvertPathFromGRPC(req.Msg.OldName))
	cleanedNewPathName := filepath.Clean(serviceutils.ConvertPathFromGRPC(req.Msg.NewName))

	if req.Msg.PathType == "folder" {
		err := fsbrowser.RenameLocalPath(cleanedPathToRename, cleanedNewPathName, fsbrowser.Folder)
		if err != nil {
			resp.Success = false
			resp.Message = err.Error()
			return connect.NewResponse(resp), nil
		}
	} else {
		err := fsbrowser.RenameLocalPath(cleanedPathToRename, cleanedNewPathName, fsbrowser.File)
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
