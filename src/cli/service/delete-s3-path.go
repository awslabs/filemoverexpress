package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func (*FileMoverServer) DeleteS3Path(
	_ context.Context,
	req *connect.Request[s3_sharedv1.DeleteS3PathRequest],
) (*connect.Response[s3_sharedv1.DeleteS3PathResponse], error) {
	resp := &s3_sharedv1.DeleteS3PathResponse{
		Success: false,
		Message: "",
	}

	cfg := config.LoadConfiguration()

	allowRemoteRenameDelete := cfg.APIServer.Permissions.AllowRemoteRenameDelete
	if !isLocalClient(req.Peer()) && !allowRemoteRenameDelete {
		resp.Success = false
		resp.Message = strRemoteDeleteNotAllowed
		return connect.NewResponse(resp), nil
	}

	txp, err := cfg.GetTransferProfile(req.Msg.TransferProfile)
	if err != nil {
		resp.Success = false
		resp.Message = err.Error()
		return connect.NewResponse(resp), nil
	}

	s3m, err := transferapi.NewS3Manager(txp)
	if err != nil {
		resp.Success = false
		resp.Message = err.Error()
		return connect.NewResponse(resp), nil
	}

	var deleteErr error

	if req.Msg.PathType == "prefix" {
		deleteErr = s3m.DeletePrefix(req.Msg.PathToDelete)
	} else {
		deleteErr = s3m.DeleteObject(req.Msg.PathToDelete)
	}

	if deleteErr != nil {
		resp.Success = false
		resp.Message = deleteErr.Error()
		return connect.NewResponse(resp), nil
	}

	resp.Success = true
	resp.Message = ""
	return connect.NewResponse(resp), nil
}
