package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/service/serviceutils"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/fs"
	"github.com/awslabs/filemoverexpress/utils/fs/fsbrowser"
)

func (*FileMoverServer) CreateLocalFolder(
	_ context.Context,
	req *connect.Request[fmev1.CreateLocalFolderRequest],
) (*connect.Response[fmev1.CreateLocalFolderResponse], error) {
	cfg := globals.GetInstance().GetCfg()
	resp := &fmev1.CreateLocalFolderResponse{
		Success: false,
		Message: "",
	}
	inputPath := filepath.Clean(serviceutils.ConvertPathFromGRPC(req.Msg.Path))

	if fsbrowser.ShouldExcludeDirEntry(inputPath, cfg.APIServer.BlockedPathList) {
		resp.Success = false
		resp.Message = fmt.Sprintf("Folder %s contains a blocked path", inputPath)

		return connect.NewResponse(resp), nil
	}

	pathExists, err := fs.PathExists(inputPath)
	if err != nil {
		resp.Success = false
		resp.Message = fmt.Sprintf("Folder %s could not be verified: %s", inputPath, err)
		return connect.NewResponse(resp), nil
	}

	if pathExists {
		resp.Success = false
		resp.Message = fmt.Sprintf("Folder %s already exists", inputPath)

		return connect.NewResponse(resp), nil
	}

	err = os.MkdirAll(inputPath, 0700)
	if err != nil {
		resp.Success = false
		resp.Message = fmt.Sprintf("Failed creating folder %s: %s", inputPath, err.Error())

		return connect.NewResponse(resp), nil
	}

	resp.Success = true
	resp.Message = ""

	return connect.NewResponse(resp), nil
}
