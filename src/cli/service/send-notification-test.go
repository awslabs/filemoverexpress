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
		// Log the full detail (including any resolved IP) to the daemon log. Return
		// the specific message only for user-fixable validation failures the
		// notifications package marked safe (bad scheme, missing host, a
		// non-routable target, an error status); every other failure - transport,
		// DNS, parse, store - stays behind the generic message so a settings-only
		// client (possibly on a remote daemon) never sees internal detail.
		logger.Error("notifications: test send to destination %q failed: %v", dest.Name, err)
		return connect.NewResponse(&fmev1.SendTestNotificationResponse{
			Success: false,
			Message: clientSafeNotifyMessage(err, strNotifyTestFailed),
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
