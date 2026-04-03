package e2e

import (
    "context"
    "log"
    "os"
    "path"
    "path/filepath"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestGRPC_CancelJob(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    setUp()

    bucket := getBucketName()
    filename := "1GbUpload.txt"
    tmpdir, tempDirErr := makeTempDir("grpc-cancel-job")
    if tempDirErr != nil {
        t.Fatalf("failed creating temp directory: %s", tempDirErr)
    }

    // Cleanup local storage and S3 bucket after the test completes
    defer removePaths(tmpdir)
    defer DeleteS3Object(path.Join("e2e-tests", "grpc-cancel-job", filename), transferProfileName)
    DeleteBoltRecord(bucket, filename, "/tmp/daemon/")

    if err := os.MkdirAll("tmp/daemon", 0755); err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err)
    }

    go assertGrpcCancelJob(t, filename, tmpdir)

    out, err := executeCommand("daemon")
    if err != nil && err.Error() != "exit status 1" {
        t.Log(out)
        log.Fatalf("Failed to cancel file: %s", err.Error())
        return
    }

    assert.NotContains(t, out, "No valid or new sources found in S3")
    assert.Contains(t, out, "User requested shutdown from GUI")
}

func assertGrpcCancelJob(t *testing.T, key string, tmpdir string) {
    client, stream := getFmeClientAndStream()
    time.Sleep(time.Second * 5)
    go scheduleShutdown(t, client)

evtLoop:
    for {
        prefix := path.Join("e2e-tests", "grpc-cancel-job")

        if success := stream.Receive(); !success {
            t.Fatalf("Stream receive failed: %s", stream.Err())
        }
        resp := stream.Msg()

        switch resp.EventType {
        case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
            time.Sleep(time.Second)
            outputFile := filepath.Join(tmpdir, key)
            makeFile(outputFile, 20*constants.MiB)
            _, err := client.UploadPrefixes(context.Background(), req[s3_sharedv1.UploadPrefixRequest](&s3_sharedv1.UploadPrefixRequest{
                TransferProfile: transferProfileName,
                BasePath:        tmpdir,
                Destination:     prefix,
                Prefixes:        []string{key},
            }))
            if err != nil {
                t.Errorf("Error making upload prefix request")
            }

        case fmev1.EventType_EVENT_TYPE_JOB_CREATE_EVENT_TYPE:
            evt := resp.GetJobCreateEvent()
            jobId := evt.Id
            cancelResp, cancelErr := client.CancelJob(
                context.Background(),
                req[fmev1.CancelJobRequest](&fmev1.CancelJobRequest{JobId: jobId}),
            )
            if cancelErr != nil {
                t.Errorf("failed to cancel job: %s\n", cancelErr)
            }
            assert.IsType(t, &fmev1.CancelJobResponse{}, cancelResp)
            if !cancelResp.Msg.Success {
                t.Errorf("Cancel job failed")
            }
            response, err := client.S3ListPrefix(context.TODO(), req[s3_sharedv1.S3ListPrefixRequest](&s3_sharedv1.S3ListPrefixRequest{
                TransferProfile: "e2e-test",
                Prefix:          prefix,
            }))
            if err != nil {
                log.Fatalf("Failed to list path %s", err.Error())
            }
            if len(response.Msg.Objects) > 0 {
                t.Errorf("Error, cancelled job resulted in uploaded file: %v", response.Msg.Objects)
            }
            _, err = client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
            if err != nil {
                t.Errorf("Failed to shut down daemon: %s", err)
            }
            break evtLoop

        case fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE:
            t.Error("Job completed, should have been cancelled")
            _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
            if err != nil {
                t.Errorf("Failed to shut down daemon: %s", err)
            }
            break evtLoop

        case fmev1.EventType_EVENT_TYPE_MESSAGE_EVENT_TYPE:
            evt := resp.GetMessageEvent()
            if evt.Msg == "No valid or new sources found in S3" {
                _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
                if err != nil {
                    t.Errorf("Failed to shut down daemon: %s", err)
                }
                time.Sleep(time.Second)

                break evtLoop
            }
            time.Sleep(time.Millisecond)
        }
    }
}
