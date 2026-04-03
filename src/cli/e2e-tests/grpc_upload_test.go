package e2e

import (
    "context"
    "log"
    "path"
    "path/filepath"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestGRPC_Upload(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    setUp()
    key := "1MbGRPCUploadTest"
    tmpdir, tempDirErr := makeTempDir("grpc-upload")
    if tempDirErr != nil {
        t.Fatalf("failed creating temp directory: %s", tempDirErr)
    }
    filename := filepath.Join(tmpdir, key)
    DeleteS3Object(path.Join("e2e-tests", key), transferProfileName)

    defer DeleteS3Object(path.Join("e2e-tests", key), transferProfileName)
    defer removePaths(tmpdir)
    go assertDaemonUploadFromDirectory(t, filename)

    out, err := executeCommand("daemon")
    if err != nil && err.Error() != "exit status 1" {
        t.Log(out)
        log.Fatalf("Failed to upload file: %s", err.Error())
        return
    }

    assert.Contains(t, out, "User requested shutdown from GUI")
}

func assertDaemonUploadFromDirectory(t *testing.T, path string) {
    client, stream := getFmeClientAndStream()

    startCount := 0
    progressCount := 0
    completeCount := 0
    disconnectCount := 0

    start := time.Now()
    var (
        uploadJobId string
        err         error
    )

evtLoop:
    for {
        if success := stream.Receive(); !success {
            t.Fatalf("Stream receive failed: %s", stream.Err())
        }
        resp := stream.Msg()

        duration := time.Since(start)
        if duration.Seconds() > MaxExecutionTime {
            shutdownRequest := fmev1.ShutdownRequest{}
            _, _ = client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&shutdownRequest))
        }

        eventType := resp.EventType

        switch eventType {
        case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
            time.Sleep(time.Second)
            uploadJobId, err = uploadFileFromPath(path, client)
            if err != nil {
                t.Error(err)
                return
            }

        case fmev1.EventType_EVENT_TYPE_JOB_CREATE_EVENT_TYPE:
            evt := resp.GetJobCreateEvent()

            if evt.Id == uploadJobId {
                startCount++
            }

        case fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE:
            jobCompleteEvt := resp.GetJobCompleteEvent()

            if jobCompleteEvt.Id == uploadJobId {
                completeCount++

                shutdownRequest := fmev1.ShutdownRequest{}
                _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&shutdownRequest))
                if err != nil {
                    t.Errorf("Failed to shutdown the daemon remotely: %s", err)
                    return
                }
            }

        case fmev1.EventType_EVENT_TYPE_JOB_PROGRESS_EVENT_TYPE:
            evt := resp.GetJobProgressEvent()
            if evt.Id == uploadJobId {
                progressCount++
            }

        case fmev1.EventType_EVENT_TYPE_SERVER_DISCONNECT_EVENT_TYPE:
            disconnectCount++
            serverDisconnect := resp.GetServerDisconnectEvent()
            assert.Equal(t, fmev1.DisconnectType_DISCONNECT_TYPE_DAEMON_MODE_EXIT_DISCONNECT_TYPE, serverDisconnect.DisconnectType)
            break evtLoop

        }

        time.Sleep(constants.SleepDuration)
    }

    expectedCount := 1

    assert.Equal(t, expectedCount, startCount, "Expected %d UploadStartEvents, Received %d", expectedCount, startCount)
    assert.GreaterOrEqual(t, progressCount, expectedCount, "Expected %d UploadProgressEvents, Received %d", expectedCount, progressCount)
    assert.Equal(t, expectedCount, completeCount, "Expected %d UploadCompleteEvents, Received %d", expectedCount, completeCount)
    assert.Equal(t, expectedCount, disconnectCount, "Expected %d ServerDisconnectEvents, Received %d", expectedCount, disconnectCount)

}
