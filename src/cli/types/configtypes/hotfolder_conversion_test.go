package configtypes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	fmev1 "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

// Test_HotFolder_ForceInitialUpload_RoundTrips ensures the ForceInitialUpload attribute survives the
// config -> protobuf -> config round trip, so a GUI save (which reconstructs config from protobuf)
// never silently drops the setting.
func Test_HotFolder_ForceInitialUpload_RoundTrips(t *testing.T) {
	for _, force := range []bool{true, false} {
		original := []UploadHotFolderSettings{{
			Name:               "hot1",
			Enabled:            true,
			LocalSourceFolder:  "/watch/folder",
			ForceInitialUpload: force,
		}}

		pb := HotFoldersToProtobuf(original)
		assert.Len(t, pb, 1)
		assert.Equal(t, force, pb[0].ForceInitialUpload)

		back := HotFoldersFromProtobuf(pb)
		assert.Len(t, back, 1)
		assert.Equal(t, force, back[0].ForceInitialUpload)
	}
}

// Test_HotFolder_ForceInitialUpload_DefaultsFalse documents that an unset attribute is false, i.e.
// the initial sweep skips already-uploaded files unless a user opts back into the legacy behavior.
func Test_HotFolder_ForceInitialUpload_DefaultsFalse(t *testing.T) {
	pb := []*fmev1.UploadHotFolderSettings{{Name: "hot1", LocalSourceFolder: "/watch/folder"}}
	back := HotFoldersFromProtobuf(pb)
	assert.Len(t, back, 1)
	assert.False(t, back[0].ForceInitialUpload)
}
