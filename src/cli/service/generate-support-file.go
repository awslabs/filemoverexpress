package service

import (
    "context"
    "encoding/base64"
    "os"
    "path/filepath"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/utils/supportfile"
)

//TODO: revive:disable:indent-error-flow -- False positive

func (*FileMoverServer) GenerateSupportFile(
    _ context.Context,
    _ *connect.Request[fmev1.CreateSupportFileRequest],
) (*connect.Response[fmev1.CreateSupportFileResponse], error) {
    response := fmev1.CreateSupportFileResponse{}
    outputFile, outputDir, err := supportfile.Create()

    if err != nil {
        response.Success = false
        response.Error = err.Error()

        return connect.NewResponse(&response), connect.NewError(connect.CodeAborted, err)
    }

    data, readErr := os.ReadFile(filepath.Join(outputDir, outputFile))
    if readErr != nil {
        response.Success = false
        response.Error = readErr.Error()

        return connect.NewResponse(&response), connect.NewError(connect.CodeAborted, readErr)
    }

    response.Filename = outputFile
    response.OutputDir = outputDir
    response.Success = true
    response.Data = base64.StdEncoding.EncodeToString(data)
    return connect.NewResponse(&response), nil
}
