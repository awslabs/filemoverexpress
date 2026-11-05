package service

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/notifications"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

const (
	strNotifyConfigDisabled = "notification configuration is disabled for remote clients"
	strNotifyDestNameBad    = "a valid destination name is required"
	strNotifyNoSuchDest     = "no such notification destination"
)

// SetNotificationDestination creates or updates a webhook destination. The URL on
// the request is write-only: it is stored encrypted and never read back.
func (*FileMoverServer) SetNotificationDestination(
	ctx context.Context,
	req *connect.Request[fmev1.SetNotificationDestinationRequest],
) (*connect.Response[fmev1.SetNotificationDestinationResponse], error) {
	if !uiConfigAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New(strNotifyConfigDisabled))
	}
	in := req.Msg.GetDestination()
	if in == nil || notifications.ValidateDestinationName(in.GetName()) != nil {
		return setNotifyResult(false, strNotifyDestNameBad, nil), nil
	}
	url := strings.TrimSpace(req.Msg.GetUrl())
	if url != "" {
		if err := notifications.ValidateWebhookURL(ctx, url); err != nil {
			return setNotifyResult(false, err.Error(), nil), nil
		}
	}
	saved, err := notifications.Shared().Upsert(configtypes.NotificationDestinationFromProtobuf(in), url)
	if err != nil {
		return setNotifyResult(false, err.Error(), nil), nil
	}
	out := saved.ToProtobuf()
	out.HasUrl = notifications.Shared().HasURL(saved.Name)
	return setNotifyResult(true, "", out), nil
}

func setNotifyResult(
	success bool,
	message string,
	dest *fmev1.NotificationDestination,
) *connect.Response[fmev1.SetNotificationDestinationResponse] {
	return connect.NewResponse(&fmev1.SetNotificationDestinationResponse{
		Success:     success,
		Message:     message,
		Destination: dest,
	})
}
