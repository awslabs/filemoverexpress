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
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestGRPC_PauseResumeJob(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    setUp()

    bucket := getBucketName()
    filename := "1MbUpload.txt"
    tmpdir, tempDirErr := makeTempDir("grpc-pause-resume-job")
    if tempDirErr != nil {
        t.Fatalf("failed creating temp directory: %s", tempDirErr)
    }

    // Cleanup local storage and S3 bucket after the test completes
    defer removePaths(tmpdir)
    defer DeleteS3Object(path.Join("e2e-tests", "grpc-pause-resume-job", filename), transferProfileName)
    DeleteBoltRecord(bucket, filename, "/tmp/daemon/")

    if err := os.MkdirAll("tmp/daemon", 0755); err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err)
    }

    go assertGrpcPauseResumeJob(t, filename, tmpdir)

    out, err := executeCommand("daemon")
    if err != nil && err.Error() != "exit status 1" {
        log.Fatalf("Failed to pause/resume file: %s", err)
        return
    }
    assert.NotContains(t, out, "No valid or new sources found in S3")
    assert.Contains(t, out, "User requested shutdown from GUI")
}

func assertGrpcPauseResumeJob(t *testing.T, key string, tmpdir string) {
    client, stream := getFmeClientAndStream()

    time.Sleep(time.Second * 5)
    pausedJob := false
    firstProgressEvent := true
    go scheduleShutdown(t, client)

evtLoop:
    for {
        prefix := path.Join("e2e-tests", "grpc-pause-resume-job")
        if success := stream.Receive(); !success {
            t.Fatalf("Stream receive failed: %s", stream.Err())
        }
        resp := stream.Msg()
        switch resp.EventType {
        case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
            outputFile := filepath.Join(tmpdir, key)
            makeFile(outputFile, 1*constants.MiB)
            _, err := client.UploadPrefixes(context.Background(), req[s3_sharedv1.UploadPrefixRequest](&s3_sharedv1.UploadPrefixRequest{
                TransferProfile: transferProfileName,
                BasePath:        tmpdir,
                Destination:     prefix,
                Prefixes:        []string{key},
                JobName:         "1MbUpload.txt",
            }))
            if err != nil {
                t.Errorf("Error making upload prefix request: %s", err)
                shutdownDaemon(t, client)
                return
            }

        case fmev1.EventType_EVENT_TYPE_JOB_PROGRESS_EVENT_TYPE:
            if !firstProgressEvent {
                break
            }

            firstProgressEvent = false
            evt := resp.GetJobProgressEvent()
            jobId := evt.Id
            pauseResp, pauseErr := client.PauseJob(context.Background(), req[fmev1.PauseJobRequest](&fmev1.PauseJobRequest{JobId: jobId}))
            if pauseErr != nil {
                t.Errorf("failed to pause job: %s", pauseErr)
                break evtLoop
            }
            assert.IsType(t, &fmev1.PauseJobResponse{}, pauseResp)
            if !pauseResp.Msg.Success {
                t.Error("Pause job failed")
                shutdownDaemon(t, client)
                return
            }

            time.Sleep(2 * time.Second)
            response, err := client.S3ListPrefix(context.TODO(), req[s3_sharedv1.S3ListPrefixRequest](&s3_sharedv1.S3ListPrefixRequest{
                TransferProfile: "e2e-test",
                Prefix:          prefix,
            }))
            if err != nil {
                t.Errorf("Failed to list path %s", err)
                shutdownDaemon(t, client)
                return
            }
            if len(response.Msg.Objects) > 0 {
                t.Errorf("Error, file uploaded while job was paused: %v", response.Msg.Objects)
                shutdownDaemon(t, client)
                return
            }
            pausedJob = true

            resumeResp, resumeErr := client.ResumeJob(context.Background(), req[fmev1.ResumeJobRequest](&fmev1.ResumeJobRequest{JobId: jobId}))
            if resumeErr != nil {
                t.Errorf("failed to resume job: %s", resumeErr)
                shutdownDaemon(t, client)
                return
            }
            assert.IsType(t, &fmev1.ResumeJobResponse{}, resumeResp)
            if !resumeResp.Msg.Success {
                t.Errorf("Resume job failed")
                shutdownDaemon(t, client)
                return
            }

        case fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE:
            if !pausedJob {
                t.Error("Got an upload complete event before the job was resumed")
            }

            jobCompleteEvt := resp.GetJobCompleteEvent()
            assert.True(t, jobCompleteEvt.Id != "")

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

func shutdownDaemon(t *testing.T, client fmev1connect.FmeServiceClient) {
    _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
    if err != nil {
        t.Errorf("Failed to shut down daemon: %s", err)
    }
}
