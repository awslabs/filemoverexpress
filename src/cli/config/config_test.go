package config

import (
	"fmt"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/configtypes"
)

func TestString(t *testing.T) {
	testS3TransferProfile := configtypes.TransferProfile{
		Bucket:      "invalid-test-bucket",
		Region:      "us-west-2",
		Accelerated: true,
		FileOrder:   []string{".jpg", ".mov"},
	}

	checkStrings := []string{
		fmt.Sprintf("Accelerated: %t", testS3TransferProfile.Accelerated),
		fmt.Sprintf("Bucket: %s", testS3TransferProfile.Bucket),
		fmt.Sprintf("FileOrder: %s", testS3TransferProfile.FileOrder),
		fmt.Sprintf("Region: %s", testS3TransferProfile.Region),
	}

	s := testS3TransferProfile.String()
	for _, checkString := range checkStrings {
		if !strings.Contains(s, checkString) {
			t.Errorf("TestString got an unexpected value. Expected '%s' in output, got '%s'", checkString, s)
		}
	}

}

func TestCheckS3ProtocolValue(t *testing.T) {
	expectedOut := 10
	s := CheckS3ProtocolValue("protocols.s3.threads")

	if s != expectedOut {
		t.Errorf("TestCheckS3ProtocolValue got an unexpected value. Expected '%d', got '%d", expectedOut, s)
	}
}

func TestLoadConfiguration(t *testing.T) {
	_, err := LoadConfiguration()
	if err != nil {
		t.Errorf("TestLoadConfiguration failed to load config file: %s\n", err)
		return
	}
}

func TestGetFilterValue(t *testing.T) {
	var expected *regexp.Regexp
	regex := GetFilterValue()
	assert.Equal(t, regex, expected)
}
