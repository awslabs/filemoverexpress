package e2e

import (
	"context"
	"log"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

const (
	grpcDeleteTestsPrefix = "e2e-tests/grpc-deleteS3Path"
)

type DeleteTest struct {
	testInput                 *s3_sharedv1.DeleteS3PathRequest
	expectedLeftoverS3Objects []string
}

var (
	// maps directory name to list of files to create in directory
	testFiles = map[string][]string{
		"prefix1": {
			"temp1.txt",
			"temp2.txt",
			"temp3.txt",
			"temp4.txt",
			"temp5.txt",
		},
		"prefix2": {
			"temp1.txt",
			"temp2.txt",
			"temp3.txt",
		},
		"": {
			"prefix1.txt",
			"prefix2temp.txt",
			"prefix21.txt",
			"prefix",
			"temp1.txt",
		},
	}
)

func TestGRPC_DeleteS3PathSinglePrefix(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping e2e tests in short mode")
	}
	setUp()
	tmpdir, tempDirErr := makeTempDir("grpc-deleteS3Path")
	if tempDirErr != nil {
		t.Fatalf("failed creating temp directory: %s", tempDirErr)
	}
	filePathsToUpload := setUpTestFiles(tmpdir)
	deleteTest := setupSinglePrefixDeleteTest()

	defer removePaths(tmpdir)
	defer DeleteS3Prefix(transferapi.FormatAsS3Prefix(grpcDeleteTestsPrefix), transferProfileName)

	go assertGrpcDeleteS3Path(t, filePathsToUpload, deleteTest, tmpdir, MaxGRPCTestExecutionTime)

	out, err := executeCommand("daemon")
	if err != nil && err.Error() != "exit status 1" {
		t.Log(out)
		log.Fatalf("Failed to upload file: %s", err.Error())
		return
	}
	assert.Contains(t, out, "User requested shutdown from GUI")
}

// TODO: Uncomment this test after figuring out why it fails... It works manually
//func TestGRPC_DeleteS3PathLargePrefix(t *testing.T) {
//	setUp()
//	// add additional test files for a directory with > MaxObjectsPerDeleteObjectsCall files
//	largeDeletePrefixNumFiles := int(math.Floor(transferapi.MaxObjectsPerDeleteObjectsCall * 2.1))
//	largeDeletePrefixTestFiles := make([]string, largeDeletePrefixNumFiles)
//	for i := 0; i < largeDeletePrefixNumFiles; i++ {
//		largeDeletePrefixTestFiles[i] = fmt.Sprintf("temp%d.txt", i+1)
//	}
//	testFiles["large-prefix"] = largeDeletePrefixTestFiles
//
//	tmpdir, tempDirErr := makeTempDir("grpc-deleteS3Path")
//	if tempDirErr != nil {
//		t.Fatalf("failed creating temp directory: %s", tempDirErr)
//	}
//	filePathsToUpload := setUpTestFiles(tmpdir)
//	deleteTest := setupLargePrefixDeleteTest()
//
//	defer removePaths(tmpdir)
//	defer DeleteS3Prefix(transferapi.FormatAsS3Prefix(grpcDeleteTestsPrefix), transferProfileName)
//
//	go assertGrpcDeleteS3Path(t, filePathsToUpload, deleteTest, tmpdir, 240)
//
//	out, err := executeCommand("daemon")
//	if err != nil && err.Error() != "exit status 1" {
//		t.Log(out)
//		log.Fatalf(fmt.Sprintf("Failed to upload file: %s", err.Error()))
//		return
//	}
//	assert.Contains(t, out, "User requested shutdown from GUI")
//}

func assertGrpcDeleteS3Path(t *testing.T, testFilesToUpload []string, deleteTest *DeleteTest, tmpdir string, maxTestTimeInSecs int) {
	client, stream := getFmeClientAndStream()
	time.Sleep(time.Second * 5)
	go scheduleShutdownCustomTime(t, client, maxTestTimeInSecs)

	var uploadJobId string
evtLoop:
	for {
		if success := stream.Receive(); !success {
			t.Fatalf("Stream receive failed: %s", stream.Err())
		}
		resp := stream.Msg()
		switch resp.EventType {
		case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
			time.Sleep(time.Second)
			result, err := client.UploadPrefixes(context.Background(), req[s3_sharedv1.UploadPrefixRequest](&s3_sharedv1.UploadPrefixRequest{
				TransferProfile: transferProfileName,
				BasePath:        tmpdir,
				Destination:     grpcDeleteTestsPrefix,
				Prefixes:        testFilesToUpload,
				Force:           true,
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
				// test delete requests with expected files in bucket after the deletion
				performDeleteTest(t, client, deleteTest)
				_, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
				if err != nil {
					t.Errorf("Failed to shut down daemon: %s", err)
				}
				break evtLoop
			} else {
				t.Errorf("Did not get job complete event for expected upload job %s, got %s instead",
					uploadJobId, jobCompleteEvt.Id)
			}
		}
		time.Sleep(time.Millisecond)
	}
}

func setUpTestFiles(tempDir string) []string {
	testParentDirectory := tempDir

	// create files
	var filePathsToUpload []string
	for directory, files := range testFiles {
		fullDirectoryName := testParentDirectory
		if directory != "" {
			fullDirectoryName = strings.Join([]string{fullDirectoryName, directory}, "/")
			err := os.MkdirAll(fullDirectoryName, 0755)
			if err != nil {
				log.Fatalf("TestGRPC_DeleteS3Path failed creating test dir %s: %s", fullDirectoryName, err)
			}
		}
		for _, file := range files {
			fullFileName := strings.Join([]string{fullDirectoryName, file}, "/")
			_, err := os.Create(fullFileName)
			if err != nil {
				log.Fatalf("TestGRPC_DeleteS3Path failed creating test file: %s", err)
			}
			filePathsToUpload = append(filePathsToUpload, fullFileName)
		}
	}
	return filePathsToUpload
}

func setupSinglePrefixDeleteTest() *DeleteTest {
	singlePrefixDeleteRequest := &s3_sharedv1.DeleteS3PathRequest{
		TransferProfile: transferProfileName,
		// testing with no trailing slash to assert that only objects in /prefix2/ get deleted
		PathToDelete: strings.Join([]string{grpcDeleteTestsPrefix, "prefix2"}, "/"),
		PathType:     "prefix",
	}

	var expectedAfterSinglePrefixDelete []string
	for directory, files := range testFiles {
		for _, file := range files {
			s3ObjectPath := constructS3ObjectPath(directory, file)
			if directory == "prefix2" {
				continue
			} else {
				expectedAfterSinglePrefixDelete = append(expectedAfterSinglePrefixDelete, s3ObjectPath)
			}
		}
	}

	return &DeleteTest{
		testInput:                 singlePrefixDeleteRequest,
		expectedLeftoverS3Objects: expectedAfterSinglePrefixDelete,
	}
}

func performDeleteTest(t *testing.T, client fmev1connect.FmeServiceClient, deleteTest *DeleteTest) {
	cfg := config.LoadConfiguration()
	txp, err := cfg.GetTransferProfile(transferProfileName)
	if err != nil {
		t.Errorf("failed to get transfer profile data for S3Manager: %s\n", err)
	}
	s3m, err := transferapi.NewS3Manager(txp)
	if err != nil {
		t.Errorf("failed to create S3Manager for testing: %s\n", err)
	}

	deleteResponse, responseErr := client.DeleteS3Path(context.TODO(), req[s3_sharedv1.DeleteS3PathRequest](deleteTest.testInput))
	if responseErr != nil {
		t.Errorf("failed to delete %s: %s\n", deleteTest.testInput.PathToDelete, responseErr.Error())
	}
	assert.IsType(t, &s3_sharedv1.DeleteS3PathResponse{}, deleteResponse)
	listObjectsOutput, err := s3m.ListObjects(transferapi.FormatAsS3Prefix(grpcDeleteTestsPrefix))
	if err != nil {
		t.Errorf("failed to get objects in S3 after delete: %s\n", err)
	}
	resultsAfterDelete := make([]string, len(listObjectsOutput.S3Objects))
	for i, object := range listObjectsOutput.S3Objects {
		resultsAfterDelete[i] = object.Key
	}
	assert.Equal(t, len(resultsAfterDelete), len(deleteTest.expectedLeftoverS3Objects),
		"Expected %d S3 objects in testing prefix, Received %d",
		len(deleteTest.expectedLeftoverS3Objects), len(resultsAfterDelete))
	slices.Sort(resultsAfterDelete)
	slices.Sort(deleteTest.expectedLeftoverS3Objects)
	for i := 0; i < len(deleteTest.expectedLeftoverS3Objects); i++ {
		if resultsAfterDelete[i] != deleteTest.expectedLeftoverS3Objects[i] {
			t.Errorf("Did not get expected leftover objects in S3 after delete")
		}
	}
}

func constructS3ObjectPath(directory string, file string) string {
	if directory == "" {
		return strings.Join([]string{grpcDeleteTestsPrefix, file}, "/")
	}
	return strings.Join([]string{grpcDeleteTestsPrefix, directory, file}, "/")
}
