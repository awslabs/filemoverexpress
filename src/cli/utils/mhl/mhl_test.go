package mhl

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/checksumtypes"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
	"github.com/awslabs/filemoverexpress/types/sourcetypes"
)

var sep = string(filepath.Separator)

const testMhlFileContents = `<?xml version='1.0' encoding='UTF-8'?>
<hashlist version="1.0">
  <creatorinfo>
    <name>John Doe</name>
    <username>jdoe</username>
    <hostname>jdoes computer</hostname>
    <startdate>2020-06-09T11:41:12.949659</startdate>
    <finishdate>2020-06-09T11:41:12.949670</finishdate>
  </creatorinfo>
  <hash>
    <file>File1</file>
    <md5>9b0dd74a941c716cfc7c8a76e25da9ef</md5>
    <size>81653</size>
    <lastmodificationdate>2020-04-29T15:58:44.499984</lastmodificationdate>
    <hashdate>2020-06-09T11:41:12.951457</hashdate>
  </hash>
  <hash>
    <file>File2</file>
    <md5>076f843a53faedc415a6b1c5ae435e2a</md5>
    <size>679831763</size>
    <lastmodificationdate>2020-04-29T15:58:33.419651</lastmodificationdate>
    <hashdate>2020-06-09T11:41:14.272699</hashdate>
  </hash>
</hashlist>
`

func TestLoadMHLFile(t *testing.T) {
	filename, err := testMhlWriteToTempFile(testMhlFileContents)
	if err != nil {
		t.Errorf("Error writing test MHL file: %s", err)
	}
	mhl, err := LoadMHLFile(filename)
	if err != nil {
		t.Errorf("TestLoadMHLFile failed: %s", err)
	}

	if len(mhl.HashList) != 2 {
		t.Errorf("TestLoadMHLFile failed, expected 2 Hash entries, got %d", len(mhl.HashList))
	}

}

func TestLoadMHLFileInvalidXML(t *testing.T) {
	c := make(chan eventtypes.Event, 1)
	err := events.Events.RegisterListener("test-listener-receive-mhl-parse-error", c, eventtypes.AllEvents)
	assert.Nil(t, err)

	filename, err := testMhlWriteToTempFile("<invalid xml")
	if err != nil {
		t.Errorf("TestLoadMHLFileInvalidXML failed writing test MHL file: %s", err)
	}

	_, err = LoadMHLFile(filename)
	select {
	case evt := <-c:
		match, _ := regexp.MatchString("Failed to read XML in file .+mhl-test-file.mhl([0-9])+: XML syntax error on line 1: unexpected EOF", evt.String())
		assert.True(t, match)
	case <-time.After(3 * time.Second):
		t.Errorf("TestLoadMHLFileInvalidXML failed, channel timed out before receiving message")
	}

	if err == nil {
		t.Errorf("TestLoadMHLFileInvalidXML failed, expected an error, but got nil")
	}
	assert.Equal(t, "XML syntax error on line 1: unexpected EOF", err.Error())
}

func TestLoadMHLFileInvalidFile(t *testing.T) {
	invalidPath := sep + "invalid-file.mhl"
	_, err := LoadMHLFile(invalidPath)
	if err == nil {
		t.Errorf("TestLoadMHLFileInvalidFile failed, expected an error, but got nil")
		return
	}

	if runtime.GOOS == "windows" {
		assert.Contains(t, err.Error(), "The system cannot find the file specified.")
	} else {
		assert.Equal(t, "open /invalid-file.mhl: no such file or directory", err.Error())
	}
}

func TestParseMhl(t *testing.T) {
	//todo: refactor this test to actually generate the files and then generate an mhl file on the fly
	//the files' creation time match what's in the mhl file so we don't get "%s referenced in MHL %s has changed
	//since MHL creation" and we can get more coverage
	cwd, err := os.Getwd()
	if err != nil {
		t.Errorf("Failed getting working directory: %s", err)
		return
	}

	td := filepath.Join(cwd, "..", "..", "testdata", "utils_sources_data")
	if err := os.Chdir(td); err != nil {
		t.Errorf("TestParseMhl failed to change cwd to testdata folder: %s", err)
	}

	_, err = LoadMHLFile("file.mhl")
	if err != nil {
		t.Error(err.Error())
	}

	removedFiles := map[string]bool{
		"file1": true,
	}
	expectedRemovedFiles := map[string]bool{
		"file1": true,
	}

	var output []*sourcetypes.SourceFile
	output = append(output, &sourcetypes.SourceFile{
		Path: "fasdfasdf",
		Size: 0,
		Checksums: &checksumtypes.Checksum{
			MD5Hex:   "",
			XXHash:   "",
			XXHash64: "",
			XXH3:     "",
		},
	})

	var expectedOutput []*sourcetypes.SourceFile
	expectedOutput = append(expectedOutput, &sourcetypes.SourceFile{
		Path: "fasdfasdf",
		Size: 0,
		Checksums: &checksumtypes.Checksum{
			MD5Hex:   "",
			XXHash:   "",
			XXHash64: "",
			XXH3:     "",
		},
	})

	ParseMhl("file.mhl", &removedFiles, &output)

	assert.Equal(t, expectedRemovedFiles, removedFiles)
	assert.Equal(t, expectedOutput, output)

}

func testMhlWriteToTempFile(contents string) (string, error) {
	f, err := os.CreateTemp("", "mhl-test-file.mhl")
	if err != nil {
		return "", err
	}
	filename := f.Name()

	_, err = f.Write([]byte(contents))
	if err != nil {
		return "", err
	}

	err = f.Close()
	if err != nil {
		return "", err
	}

	return filename, nil
}
