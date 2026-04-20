package cmd

import (
	"testing"

	"github.com/awslabs/filemoverexpress/globals"
)

func TestHasValidTransferProfiles(t *testing.T) {
	global := globals.GetInstance()
	hasValidTransferProfiles(global)
}
