package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/fs/fsbrowser"
)

func (*FileMoverServer) ListFolder(
	_ context.Context,
	req *connect.Request[fmev1.ListFolderRequest],
) (*connect.Response[fmev1.FsFolder], error) {
	res, err := fsbrowser.ListDirectory(req.Msg.Path)
	if err != nil {
		err = connect.NewError(connect.CodeInvalidArgument, err)
	}
	return connect.NewResponse(res), err
}
