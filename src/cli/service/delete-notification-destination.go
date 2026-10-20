package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/notifications"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// DeleteNotificationDestination removes a webhook destination's metadata and its
// stored URL. It is idempotent: deleting an unknown name succeeds.
func (*FileMoverServer) DeleteNotificationDestination(
	_ context.Context,
	req *connect.Request[fmev1.DeleteNotificationDestinationRequest],
) (*connect.Response[fmev1.DeleteNotificationDestinationResponse], error) {
	if !uiConfigAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New(strNotifyConfigDisabled))
	}
	name := req.Msg.GetName()
	if notifications.ValidateDestinationName(name) != nil {
		return connect.NewResponse(&fmev1.DeleteNotificationDestinationResponse{
			Success: false,
			Message: strNotifyDestNameBad,
		}), nil
	}
	if err := notifications.Shared().Remove(name); err != nil {
		return connect.NewResponse(&fmev1.DeleteNotificationDestinationResponse{
			Success: false,
			Message: err.Error(),
		}), nil
	}
	return connect.NewResponse(&fmev1.DeleteNotificationDestinationResponse{Success: true}), nil
}
