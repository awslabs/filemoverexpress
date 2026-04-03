package e2e

import (
    "fmt"
    "log"
    "os"
    "path"
    "path/filepath"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestCLI_Upload(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    filename := "UploadTest"
    key := path.Join("e2e-tests", filename)

    removePaths(filename)
    DeleteS3Object(key, transferProfileName)

    tmpdir, err := makeTempDir("cli-upload")
    if err != nil {
        log.Fatalf("Failed to create tmp directory: %s", err.Error())
    }

    testFilePath := filepath.Join(tmpdir, filename)
    makeFile(testFilePath, MiB)
    defer removePaths(tmpdir)
    defer DeleteS3Object(key, transferProfileName)

    cwd, err := os.Getwd()
    if err != nil {
        t.Fatalf("Failed getting current directory: %s", err)
    }
    defer func(dir string) {
        err := os.Chdir(dir)
        if err != nil {
            t.Fatalf("Failed returning to previous directory: %s", err)
        }
    }(cwd)

    err = os.Chdir(tmpdir)
    if err != nil {
        t.Fatalf("Failed to change to source directory: %s", err)
    }

    out, err := executeCommand("upload", transferProfileName, filename)
    if err != nil {
        t.Log(out)
        log.Fatalf("Failed to upload file: %s", err.Error())
        return
    }

    assert.Contains(t, out, fmt.Sprintf("Created %s job '%s'", "upload", filename))
    assert.Contains(t, out, fmt.Sprintf("Finished job '%s'", filename))
}
