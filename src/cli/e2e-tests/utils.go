package e2e

import (
    "context"
    "errors"
    "fmt"
    "log"
    "net/http"
    "net/http/httptest"
    "os"
    "os/exec"
    "path"
    "path/filepath"
    "runtime"
    "strings"
    "testing"
    "time"

    "connectrpc.com/connect"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/aws-sdk-go-v2/service/s3/types"
    transferApi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/service"
    s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
)

const (
    MaxExecutionTime         = 25
    e2eTestDir               = "tmp/daemon/"
    transferProfileName      = "e2e-test" //nolint
    MiB                      = int64(1048576)
    MaxGRPCTestExecutionTime = 60
)

var binaryPath string

func init() {
    var err error
    binaryPath, err = filepath.Abs(fmt.Sprintf("../dist/%s_%s_%s_race", constants.ProductCLIName, runtime.GOOS, runtime.GOARCH))
    if err != nil {
        fmt.Printf("Failed to get binary path: %s", err)
    }
}

func setUp() {
    err := os.RemoveAll("/" + e2eTestDir)
    if err != nil {
        log.Fatal(err.Error())
    }

    err = os.MkdirAll(e2eTestDir, 0755)
    if err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err.Error())
    }

    err = os.MkdirAll("/"+e2eTestDir, 0755)
    if err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err.Error())
    }
}

func DeleteS3Object(key string, transferProfileName string) {
    transferProfile, err := globals.GetInstance().GetCfg().GetTransferProfile(transferProfileName)
    if err != nil {
        log.Fatalf("Failed to load transfer profile: %s", err.Error())
    }

    s3m, err := transferApi.NewS3Manager(transferApi.S3ManagerConfig{
        AwsProfile: transferProfile.Profile,
        Bucket:     transferProfile.Bucket,
        Region:     transferProfile.Region,
        Endpoint:   transferProfile.Endpoint,
    })
    if err != nil {
        log.Fatalf("Failed to load session: %s", err.Error())
    }
    _, err = s3m.Client.DeleteObject(context.TODO(), &s3.DeleteObjectInput{
        Bucket: &transferProfile.Bucket,
        Key:    &key,
    })
    if err != nil {
        var notFound *types.NotFound
        switch {
        case errors.As(err, &notFound):
            return
        default:
            fmt.Printf("Failed to delete file: %s\n", err.Error())
        }
    }
}

func DeleteS3Prefix(prefix string, transferProfileName string) {
    transferProfile, err := globals.GetInstance().GetCfg().GetTransferProfile(transferProfileName)
    if err != nil {
        log.Fatalf("Failed to load transfer profile: %s", err.Error())
    }

    s3m, err := transferApi.NewS3Manager(transferApi.S3ManagerConfig{
        AwsProfile: transferProfile.Profile,
        Bucket:     transferProfile.Bucket,
        Region:     transferProfile.Region,
        Endpoint:   transferProfile.Endpoint,
    })
    if err != nil {
        log.Fatalf("Failed to load session: %s", err.Error())
    }
    err = s3m.DeletePrefix(prefix)
    if err != nil {
        fmt.Printf("Failed to clean up S3 prefix %s: %s\n", prefix, err.Error())
    }
}

func DeleteBoltRecord(bucket string, key string, destination string) {
    db, err := databasetypes.New()
    if err != nil {
        events.Events.Fatal("Failed to initialize the database: %s", err)
        return
    }
    dbKey := databasetypes.BuildKey(bucket, key, destination)
    dbObj, err := db.FindObject(dbKey)
    if err != nil {
        if err.Error() != "no such key" {
            log.Fatalf("Failed to look up file in local database: %s\n", err)
        }
    }

    if dbObj != (databasetypes.DatabaseObject{}) {
        databasetypes.DBLock.Lock()
        err = db.Delete(dbKey)
        databasetypes.DBLock.Unlock()
        if err != nil {
            log.Fatalf("Failed to delete record in local database: %s\n", err)
        }
    }
    db.Close()
}

func makeFile(name string, size int64) {
    fd, err := os.Create(name)

    if err != nil {
        log.Fatalf("Failed to create output")
    }
    _, err = fd.Seek(size-1, 0)
    if err != nil {
        log.Fatalf("Failed to seek")
    }
    _, err = fd.Write([]byte{0})
    if err != nil {
        log.Fatalf("Write failed")
    }
    err = fd.Close()
    if err != nil {
        log.Fatalf("Failed to close file")
    }
}

//nolint:deadcode
func getBucketName() string {
    if bucket, ok := os.LookupEnv("E2E_BUCKET"); ok {
        return bucket
    }
    return "fme-e2e-tests"
}

func getFmeClientAndStream() (fmev1connect.FmeServiceClient, *connect.ServerStreamForClient[fmev1.ListEventsResponse]) {
    mux := http.NewServeMux()
    mux.Handle(fmev1connect.NewFmeServiceHandler(service.NewService("127.0.0.1", []uint{50006}, false)))
    server := httptest.NewUnstartedServer(mux)
    server.EnableHTTP2 = true
    defer server.Client()

    fmeClient := fmev1connect.NewFmeServiceClient(
        server.Client(),
        server.URL,
    )

    fmeGrpcClient := fmev1connect.NewFmeServiceClient(
        server.Client(),
        server.URL,
        connect.WithGRPCWeb(),
    )

    stream, streamErr := fmeGrpcClient.ListEvents(context.Background(), req[fmev1.ListEventsRequest](&fmev1.ListEventsRequest{}))
    if streamErr != nil {
        return nil, nil
    }

    return fmeClient, stream
}

//nolint:deadcode
//func getGRPCStream() fmev1connect.FmeServiceClient {
//    ctx := context.Background()
//    conn, err := grpc.NewClient[fmev1.ListEventsRequest](":50006", grpc.WithTransportCredentials(insecure.NewCredentials()))
//    if err != nil {
//        log.Fatalf(fmt.Sprintf("can't connect with server %v", err))
//    }
//    client := fmev1connect.NewFmeServiceClient(conn)
//    var stream *connect.ServerStreamForClient[fmev1.ListEventsResponse]
//    connected := false
//    attempts := 0
//    for !connected {
//        stream, err = client.ListEvents(context.TODO(), &fmev1.ListEventsRequest{Count: 1})
//        if err != nil {
//            time.Sleep(RetryInterval)
//            continue
//        }
//
//        connected = true
//        attempts++
//        if attempts > MaxConnectionAttempts {
//            log.Fatalf("Unable to connect to grpc host... exiting")
//        }
//    }
//    return stream, client
//}

func executeCommand(args ...string) (string, error) {
    return executeCommandWithEnv([]string{}, args...)
}

// #nosec G204 -- Disable the warning about launching a command from variables as this is not exposed, or even included in the output binary
func executeCommandWithEnv(env []string, args ...string) (string, error) {
    foundEnvVar := false
    for _, envVar := range env {
        if strings.HasPrefix(envVar, "FME_GUI_DAEMON=") {
            foundEnvVar = true
            break
        }
    }

    if !foundEnvVar {
        env = append(env, "FME_GUI_DAEMON=true")
    }
    command := exec.Command(binaryPath, args...)
    command = addEnvToCommand(command)
    command.Env = append(command.Env, env...)
    stdout, err := command.CombinedOutput()

    return string(stdout), err
}

func addEnvToCommand(cmd *exec.Cmd) *exec.Cmd {
    cmd.Env = os.Environ()
    cmd.Env = append(cmd.Env, "FME_E2E=true")
    cmd.Env = append(cmd.Env, "GORACE=halt_on_error=1")
    return cmd
}

func uploadFileFromPath(filename string, client fmev1connect.FmeServiceClient) (string, error) {
    if err := os.MkdirAll(path.Dir(filename), 0755); err != nil {
        fmt.Printf("Failed to create directory %s: %s", path.Dir(filename), err)
    }
    makeFile(filename, MiB)

    uploadPrefixRequest := s3sharedv1.UploadPrefixRequest{
        TransferProfile: transferProfileName,
        BasePath:        filepath.Dir(filename),
        Destination:     "e2e-tests",
        Prefixes: []string{
            filepath.Base(filename),
        },
    }
    resp, err := client.UploadPrefixes(context.TODO(), connect.NewRequest[s3sharedv1.UploadPrefixRequest](&uploadPrefixRequest))
    if err != nil {
        return "", err
    }

    if !resp.Msg.Success {
        return "", errors.New("failed submitting upload request")
    }

    return resp.Msg.JobId, nil
}

func scheduleShutdown(t *testing.T, client fmev1connect.FmeServiceClient) {
    scheduleShutdownCustomTime(t, client, MaxGRPCTestExecutionTime)
}

// scheduleShutdownCustomTime should only be used for tests that are expected to take longer than MaxGRPCDownloadTestExecutionTime
func scheduleShutdownCustomTime(t *testing.T, client fmev1connect.FmeServiceClient, customMaxTime int) {
    for start := time.Now(); time.Since(start).Seconds() < float64(customMaxTime); {
        time.Sleep(time.Second)
    }

    t.Log("Max time allowed reached... initiating shutdown")
    shutdown := fmev1.ShutdownRequest{}
    _, _ = client.Shutdown(context.TODO(), connect.NewRequest[fmev1.ShutdownRequest](&shutdown))
}

func makeTempDir(test string) (string, error) {
    tmpdir, err := os.MkdirTemp(os.TempDir(), fmt.Sprintf("%s-*", test))
    if err != nil {
        return "", err
    }

    return tmpdir, nil
}

func removePaths(paths ...string) {
    for _, p := range paths {
        if err := os.RemoveAll(p); err != nil {
            fmt.Printf("Failed to remove path %s: %s", p, err)
        }
    }
}

func cliDownloadCleanup(key string, destination string, bucket string) {
    DeleteBoltRecord(bucket, path.Join("e2e-tests/", key), destination)
    DeleteS3Object(path.Join("e2e-tests", key), transferProfileName)
    removePaths(key)
}

// req is just a simple wrapper for connect.NewRequest[T](req)
func req[T any](req *T) *connect.Request[T] {
    return connect.NewRequest[T](req)
}
