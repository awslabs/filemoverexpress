package service

import (
	"context"
	"errors"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/notifications"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// SendTestNotification posts a test message to a configured destination so the
// user can confirm the webhook works before relying on it.
func (*FileMoverServer) SendTestNotification(
	_ context.Context,
	req *connect.Request[fmev1.SendTestNotificationRequest],
) (*connect.Response[fmev1.SendTestNotificationResponse], error) {
	if !uiConfigAllowed(req.Peer()) {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New(strNotifyConfigDisabled))
	}
	dest, found := findConfiguredDestination(req.Msg.GetName())
	if !found {
		return connect.NewResponse(&fmev1.SendTestNotificationResponse{
			Success: false,
			Message: strNotifyNoSuchDest,
		}), nil
	}
	if err := notifications.Shared().SendTest(dest); err != nil {
		// The error is already URL-redacted by the notifications package, but it
		// still belongs in the daemon log, not in an RPC response a settings-only
		// client can read. Return a generic message.
		logger.Error("notifications: test send to destination %q failed: %v", dest.Name, err)
		return connect.NewResponse(&fmev1.SendTestNotificationResponse{
			Success: false,
			Message: strNotifyTestFailed,
		}), nil
	}
	return connect.NewResponse(&fmev1.SendTestNotificationResponse{Success: true}), nil
}

func findConfiguredDestination(name string) (configtypes.NotificationDestination, bool) {
	for _, dest := range config.LoadConfiguration().Notifications.Destinations {
		if dest.Name == name {
			return dest, true
		}
	}
	return configtypes.NotificationDestination{}, false
}
