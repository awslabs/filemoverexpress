package service

import (
	"context"
	"os"
	"time"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/daemontypes"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func (*FileMoverServer) Shutdown(
	_ context.Context,
	_ *connect.Request[fmev1.ShutdownRequest],
) (*connect.Response[fmev1.ShutdownResponse], error) {
	guiEnvVariable, _ := os.LookupEnv("FME_GUI_DAEMON")
	if guiEnvVariable == "true" {
		defer time.AfterFunc(time.Second, doShutdown)
		return connect.NewResponse(&fmev1.ShutdownResponse{Result: fmev1.ShutdownResult_SHUTDOWN_RESULT_SUCCEEDED}), nil
	}

	logger.SendLog(logger.InfoLevel, "Daemon shutdown only allowed when daemon is started by UI")
	return connect.NewResponse(&fmev1.ShutdownResponse{Result: fmev1.ShutdownResult_SHUTDOWN_RESULT_RESTRICTED}), nil
}

func doShutdown() {
	nrd := daemontypes.GetInstance()
	logger.SendLog("Info", "User requested shutdown from GUI")
	nrd.Shutdown()
}
