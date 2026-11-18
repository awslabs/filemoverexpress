package service

import (
	"context"
	"errors"
	"strings"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/core/notifications"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

const (
	strNotifyConfigDisabled = "notification configuration is disabled for remote clients"
	strNotifyDestNameBad    = "a valid destination name is required"
	strNotifyNoSuchDest     = "no such notification destination"
	strNotifyTestFailed     = "test notification failed; see the FME daemon log for details"
	strNotifyURLInvalid     = "the webhook url could not be validated; see the FME daemon log for details"
	strNotifySaveFailed     = "saving the notification destination failed; see the FME daemon log for details"
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
	if in == nil {
		return setNotifyResult(false, strNotifyDestNameBad, nil), nil
	}
	if err := notifications.ValidateDestinationName(in.GetName()); err != nil {
		// The validator's messages describe the naming rule, not the input, so
		// they are safe to return and tell the user how to fix the name.
		return setNotifyResult(false, err.Error(), nil), nil
	}
	url := strings.TrimSpace(req.Msg.GetUrl())
	if url != "" {
		if err := notifications.ValidateWebhookURL(ctx, url); err != nil {
			// Log the full detail (which may include the resolved IP); return only
			// the client-safe message so a settings client never sees it. A bad
			// scheme, missing host, non-routable target, or malformed URL comes
			// back with its own specific text; a DNS failure (whose detail names
			// the host) stays behind the url-oriented generic.
			logger.Error("notifications: set destination %q rejected: %v", in.GetName(), err)
			return setNotifyResult(false, clientSafeNotifyMessage(err, strNotifyURLInvalid), nil), nil
		}
	}
	saved, err := notifications.Shared().Upsert(configtypes.NotificationDestinationFromProtobuf(in), url)
	if err != nil {
		// Upsert errors can carry filesystem paths from the store; keep them in the
		// log and return the generic message.
		logger.Error("notifications: saving destination %q failed: %v", in.GetName(), err)
		return setNotifyResult(false, clientSafeNotifyMessage(err, strNotifySaveFailed), nil), nil
	}
	out := saved.ToProtobuf()
	out.HasUrl = notifications.Shared().HasURL(saved.Name)
	return setNotifyResult(true, "", out), nil
}

// clientSafeNotifyMessage returns a message safe to send to a settings client:
// the specific text when the notifications package marked err public (a
// user-fixable, secret-free failure), otherwise the generic fallback. The full
// err is logged by the caller for the daemon log.
func clientSafeNotifyMessage(err error, generic string) string {
	if public, ok := notifications.PublicMessage(err); ok {
		return public
	}
	return generic
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
