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

    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestGRPC_Download(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    setUp()

    bucket := getBucketName()
    filename := "1mbGrpcDownloadTest"
    tmpdir, tempDirErr := makeTempDir("grpc-download")
    if tempDirErr != nil {
        t.Fatalf("failed creating temp directory: %s", tempDirErr)
    }

    // Cleanup local storage and S3 bucket after the test completes
    defer removePaths(tmpdir)
    defer DeleteS3Object(path.Join("e2e-tests", "grpc-download", filename), transferProfileName)
    DeleteBoltRecord(bucket, filename, "/tmp/daemon/")

    if err := os.MkdirAll("tmp/daemon", 0755); err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err)
    }

    go assertGrpcInitiatedDownloads(t, filename, tmpdir)

    out, err := executeCommand("daemon")
    if err != nil && err.Error() != "exit status 1" {
        t.Log(out)
        log.Fatalf("Failed to download file: %s", err.Error())
        return
    }
    assert.NotContains(t, out, "No valid or new sources found in S3")
    assert.Contains(t, out, "User requested shutdown from GUI")
}

func assertGrpcInitiatedDownloads(t *testing.T, key string, tmpdir string) {
    client, stream := getFmeClientAndStream()
    time.Sleep(time.Second * 5)
    go scheduleShutdown(t, client)

    completeCount := 0

    var (
        uploadJobId   string
        downloadJobId string
    )
evtLoop:
    for {
        prefix := path.Join("e2e-tests", "grpc-download")
        if success := stream.Receive(); !success {
            t.Fatalf("Stream receive failed: %s", stream.Err())
        }
        resp := stream.Msg()

        switch resp.EventType {
        case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
            time.Sleep(time.Second)
            outputFile := filepath.Join(tmpdir, key)
            makeFile(outputFile, MiB)
            result, err := client.UploadPrefixes(context.Background(), req[s3_sharedv1.UploadPrefixRequest](&s3_sharedv1.UploadPrefixRequest{
                TransferProfile: transferProfileName,
                BasePath:        tmpdir,
                Destination:     prefix,
                Prefixes:        []string{key},
            }))
            if err != nil {
                t.Errorf("Failed to upload test file: %s", err)
            }

            if !result.Msg.Success {
                t.Errorf("Failed to initiate upload: %s", result.Msg.Response)
                return
            }

            uploadJobId = result.Msg.JobId

        case fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE:
            jobCompleteEvt := resp.GetJobCompleteEvent()

            if jobCompleteEvt.Id == uploadJobId {
                downloadReq := s3_sharedv1.DownloadPrefixesRequest{
                    Prefixes:        []string{path.Join(prefix, key)},
                    Destination:     "/" + e2eTestDir,
                    TransferProfile: transferProfileName,
                }
                downloadResp, responseErr := client.DownloadPrefixes(
                    context.Background(),
                    req[s3_sharedv1.DownloadPrefixesRequest](&downloadReq),
                )
                if responseErr != nil {
                    t.Errorf("failed to download: %s\n", responseErr.Error())
                }

                assert.IsType(t, &s3_sharedv1.DownloadPrefixesResponse{}, downloadResp)

                downloadJobId = downloadResp.Msg.JobId
                completeCount++
            } else if jobCompleteEvt.Id == downloadJobId {
                completeCount++

                assert.True(t, jobCompleteEvt.Id != "")

                _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
                if err != nil {
                    t.Errorf("Failed to shut down daemon: %s", err)
                }
                break evtLoop
            }

        case fmev1.EventType_EVENT_TYPE_MESSAGE_EVENT_TYPE:
            evt := resp.GetMessageEvent()
            if evt.Msg == "No valid or new sources found in S3" {
                _, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
                if err != nil {
                    t.Errorf("Failed to shut down daemon: %s", err)
                }

                break evtLoop
            }
        }
        time.Sleep(time.Millisecond)
    }

    expectedCompleteCount := 2
    assert.GreaterOrEqual(t, completeCount, expectedCompleteCount, "Expected %d DownloadCompleteEvents, Received %d", expectedCompleteCount, completeCount)
}
