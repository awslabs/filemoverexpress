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
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

const testChildDir = "childdir1"
const testChildDir2 = "childdir2"

func TestListPrefixes(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping e2e tests in short mode")
	}
	setUp()
	prefix := path.Join("e2e-tests", "list-prefixes")
	tmpdir, sources, err := createListPathTestFiles()
	if err != nil {
		log.Fatalf("Failed to create directory structure for test: %s", err)
	}

	go assertS3ListPath(t, tmpdir, sources, prefix)

	out, err := executeCommand("daemon")
	if err != nil && err.Error() != "exit status 1" {
		t.Log(out)
		log.Fatalf("failed setting configs: %s", err.Error())
		return
	}
	assert.Contains(t, out, "User requested shutdown from GUI")
	defer func() {
		for _, key := range sources {
			DeleteS3Object(path.Join(prefix, key), transferProfileName)
		}
	}()
}

func assertS3ListPath(t *testing.T, tmpdir string, sources []string, prefix string) {
	if err := waitForUploads(tmpdir, sources, prefix); err != nil {
		t.Fatalf("Failed while uploading test data: %s", err)
	}

	client, _ := getFmeClientAndStream()
	defer func() {
		_, err := client.Shutdown(context.TODO(), req[fmev1.ShutdownRequest](&fmev1.ShutdownRequest{}))
		if err != nil {

		}
	}()

	firstChildResponse, err := client.S3ListPrefix(context.TODO(), req[s3_sharedv1.S3ListPrefixRequest](&s3_sharedv1.S3ListPrefixRequest{
		TransferProfile: "e2e-test",
		Prefix:          path.Join(prefix, testChildDir),
	}))
	if err != nil {
		log.Fatalf("Failed to list path %s", err.Error())
	}

	assert.IsType(t, &s3_sharedv1.S3ListPrefixResponse{}, firstChildResponse)

	firstChildObjects := firstChildResponse.Msg.Objects
	if len(firstChildObjects) != 1 {
		t.Fatalf("Expected 1 folder with prefix childdir1, got %d", len(firstChildObjects))
	}
	firstChildFolders := firstChildResponse.Msg.Prefixes
	if len(firstChildFolders) != 1 {
		t.Fatalf("Expected 1 folder with prefix childdir1, got %d", len(firstChildFolders))
	}
	assert.Equal(t, path.Join(prefix, "childdir1/file1"), firstChildObjects[0].Key)
	assert.Equal(t, path.Join(prefix, "childdir1/childdir2")+"/", firstChildFolders[0])

	secondChildResponse, err := client.S3ListPrefix(context.TODO(), req[s3_sharedv1.S3ListPrefixRequest](&s3_sharedv1.S3ListPrefixRequest{
		TransferProfile: "e2e-test",
		Prefix:          path.Join(prefix, testChildDir, testChildDir2),
	}))
	if err != nil {
		log.Fatalf("Failed to child path %s", err.Error())
	}
	assert.IsType(t, &s3_sharedv1.S3ListPrefixResponse{}, secondChildResponse)

	secondChildObjects := secondChildResponse.Msg.Objects
	if len(secondChildObjects) != 1 {
		t.Fatalf("Expected 1 object in childdir2, got %d", len(secondChildObjects))
	}
	assert.Equal(t, path.Join(prefix, "childdir1/childdir2/file2"), secondChildObjects[0].Key)

	secondChildPrefixes := secondChildResponse.Msg.Prefixes
	if len(secondChildPrefixes) != 0 {
		t.Fatalf("Expected 0 prefixes in childdir2, got %d", len(secondChildPrefixes))
	}
	assert.Equal(t, 0, len(secondChildPrefixes))
}

func waitForUploads(tmpdir string, sources []string, prefix string) error {
	client, stream := getFmeClientAndStream()

	for {
		if success := stream.Receive(); !success {
			return stream.Err()
		}
		resp := stream.Msg()

		switch resp.EventType {
		case fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE:
			err := uploadTestFiles(client, tmpdir, sources, prefix)
			if err != nil {
				return err
			}

		case fmev1.EventType_EVENT_TYPE_JOB_COMPLETE_EVENT_TYPE:
			return nil
		}
		time.Sleep(time.Millisecond)
	}
}

func createListPathTestFiles() (string, []string, error) {
	sources := make([]string, 0)
	tmpdir, err := makeTempDir("list-prefixes")
	if err != nil {
		return tmpdir, sources, err
	}

	err = os.MkdirAll(filepath.Join(tmpdir, testChildDir, testChildDir2), 0755)
	if err != nil {
		return tmpdir, sources, err
	}

	f1 := filepath.Join(testChildDir, "file1")
	f2 := filepath.Join(testChildDir, testChildDir2, "file2")
	sources = append(sources, f1, f2)

	makeFile(path.Join(tmpdir, f1), MiB)
	makeFile(path.Join(tmpdir, f2), MiB)

	return tmpdir, sources, err
}

func uploadTestFiles(client fmev1connect.FmeServiceClient, sourceDir string, sourceFiles []string, destination string) error {
	_, err := client.UploadPrefixes(context.TODO(), req[s3_sharedv1.UploadPrefixRequest](&s3_sharedv1.UploadPrefixRequest{
		TransferProfile: transferProfileName,
		BasePath:        sourceDir,
		Destination:     destination,
		Prefixes:        sourceFiles,
	}))

	return err
}
