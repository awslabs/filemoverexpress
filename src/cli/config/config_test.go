package config

import (
	"fmt"
	"strings"
	"testing"

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
