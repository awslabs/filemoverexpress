package service

import (
	"context"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/inventory"
	"github.com/awslabs/filemoverexpress/types/inventorytypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) GenerateInventoryReport(
	_ context.Context,
	req *connect.Request[fmev1.InventoryReportRequest],
) (*connect.Response[fmev1.InventoryReportResponse], error) {
	resp := fmev1.InventoryReportResponse{}
	transferProfile, err := config.LoadConfiguration().GetTransferProfile(req.Msg.GetTransferProfile())
	if err != nil {
		resp.Success = false
		resp.Message = strFailedToFindTransferProfile
		return connect.NewResponse(&resp), connect.NewError(connect.CodeInvalidArgument, err)
	}

	irInput := inventorytypes.GenerateInventoryInput{
		TransferProfile:  transferProfile,
		OutputFormat:     req.Msg.OutputFormat,
		Pretty:           req.Msg.Pretty,
		IncludeChecksums: req.Msg.IncludeChecksums,
	}

	go func(input inventorytypes.GenerateInventoryInput) {
		err = inventory.GenerateInventory(input)
		if err != nil {
			events.Events.Warn(strFailedGeneratingInventory, err)
		}
	}(irInput)

	resp.Success = true
	resp.Message = ""

	return connect.NewResponse(&resp), nil
}
