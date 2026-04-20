package e2e

import (
	"fmt"
	"log"
	"os"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCLI_Download(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping e2e tests in short mode")
	}
	key := "tmp/DownloadTest"
	jobName := "tmp/"
	uploadDestination := "./"
	bucket := getBucketName()

	// Defer a cleanup for post-test cleanup, and then call cleanup to remove
	// any existing cache or object, in case of a previous test failures
	defer cliDownloadCleanup(key, uploadDestination, bucket)
	cliDownloadCleanup(key, uploadDestination, bucket)

	err := os.MkdirAll("tmp", 0755)
	if err != nil {
		log.Fatalf("Failed to create tmp directory: %s", err.Error())
	}
	makeFile(key, MiB)

	out, err := executeCommand("upload", transferProfileName, path.Join(uploadDestination, key))
	if err != nil {
		t.Log(out)
		log.Fatalf("Failed to upload file: %s", err.Error())
	}

	if err := os.RemoveAll("./" + key); err != nil {
		t.Logf("Failed to clean up CLI download testfile %s: %s", key, err)
	}

	downloadDestination := "tmp/"
	out, err = executeCommand("download", transferProfileName, uploadDestination, downloadDestination)
	if err != nil {
		t.Log(out)
		log.Fatalf("Failed to download file: %s", err)
	}

	assert.Contains(t, out, fmt.Sprintf("Created %s job '%s'", "download", jobName))
	assert.Contains(t, out, fmt.Sprintf("Finished job '%s'", jobName))
}
