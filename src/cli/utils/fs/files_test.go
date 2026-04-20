package fs

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCloseFile(t *testing.T) {
	testFileContent := []byte("temp file contents")
	dir, err := os.MkdirTemp("", "fme-test")
	if err != nil {
		t.Error("TestCloseFile failed setting up temp dir for tests: " + err.Error())
	}

	defer func(path string) {
		err := os.RemoveAll(path)
		if err != nil {
			t.Errorf("TestCloseFile: error deleting test directory: %s", path)
		}
	}(dir)

	testFile := filepath.Join(dir, "test-file")
	if err := os.WriteFile(testFile, testFileContent, 0644); err != nil {
		t.Errorf("TestCloseFile failed writing test file data: %s", err.Error())
	}

	f, err := os.Open(testFile)
	if err != nil {
		t.Errorf("TestCloseFile failed opening file for reading: %s", err.Error())
		return
	}

	buffer := make([]byte, 18)
	bytesRead, err := f.Read(buffer)
	if err != nil {
		t.Error("TestCloseFile failed reading data from test-file: " + err.Error())
	}

	if bytesRead != len(testFileContent) {
		t.Errorf("TestCloseFile read incorrect number of bytes. Read %d bytes, expected %d bytes",
			bytesRead,
			len(testFileContent))
	}

	if closed := CloseFile(CloseFileInput{f, false}); !closed {
		t.Error("TestCloseFile failed to correctly close test-file")
	}

	if closed := CloseFile(CloseFileInput{f, false}); closed {
		t.Error("TestCloseFile incorrectly closed an already closed file")
	}
}
