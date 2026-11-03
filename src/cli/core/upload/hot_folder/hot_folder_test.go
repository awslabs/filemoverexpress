package hot_folder

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

// mockUploadDeps is a testify/mock fake of the uploadDeps seam. The method-name strings passed
// to .On / AssertCalled below ("GetTransferProfile", "NewJob", "Uploader") are matched at test
// time against these method names; keep them in sync with the uploadDeps interface.
type mockUploadDeps struct {
	mock.Mock
}

func (m *mockUploadDeps) GetTransferProfile(profileName string) (configtypes.TransferProfile, error) {
	args := m.Called(profileName)
	return args.Get(0).(configtypes.TransferProfile), args.Error(1)
}

func (m *mockUploadDeps) NewJob(cfg jobmanagertypes.JobConfig) (*jobmanagertypes.Job, error) {
	args := m.Called(cfg)
	return args.Get(0).(*jobmanagertypes.Job), args.Error(1)
}

func (m *mockUploadDeps) Uploader(job *jobmanagertypes.Job) {
	m.Called(job)
}

func Test_keysForHotFolder(t *testing.T) {
	sourceFolder := filepath.Join("tmp", "hot", "folderab")
	nested := filepath.Join(sourceFolder, "sub", "clip.mov")
	tests := []struct {
		name         string
		sourceFolder string
		files        []string
		wantKeys     []string
		wantMatched  []string
	}{
		{
			name:         "matches files in the source folder and trims to relative keys",
			sourceFolder: sourceFolder,
			files:        []string{filepath.Join(sourceFolder, "a.mov"), nested},
			wantKeys:     []string{"a.mov", filepath.Join("sub", "clip.mov")},
			wantMatched:  []string{filepath.Join(sourceFolder, "a.mov"), nested},
		},
		{
			name:         "excludes files outside the source folder",
			sourceFolder: sourceFolder,
			files:        []string{filepath.Join("tmp", "other", "b.mov"), filepath.Join(sourceFolder, "c.mov")},
			wantKeys:     []string{"c.mov"},
			wantMatched:  []string{filepath.Join(sourceFolder, "c.mov")},
		},
		{
			name:         "returns nothing when no files match",
			sourceFolder: sourceFolder,
			files:        []string{filepath.Join("tmp", "other", "d.mov")},
			wantKeys:     nil,
			wantMatched:  nil,
		},
		{
			// Regression: a sibling folder whose name is a string prefix of another
			// ("folder" vs "folderab") must not swallow the sibling's files. A raw
			// strings.HasPrefix check would incorrectly match "tmp/hot/folderab/x.mov"
			// against source folder "tmp/hot/folder".
			name:         "does not match a sibling folder that shares a name prefix",
			sourceFolder: filepath.Join("tmp", "hot", "folder"),
			files:        []string{filepath.Join("tmp", "hot", "folderab", "x.mov")},
			wantKeys:     nil,
			wantMatched:  nil,
		},
		{
			// The true sibling's own files still match its source folder.
			name:         "matches the sibling folder's own files",
			sourceFolder: filepath.Join("tmp", "hot", "folder"),
			files:        []string{filepath.Join("tmp", "hot", "folder", "y.mov")},
			wantKeys:     []string{"y.mov"},
			wantMatched:  []string{filepath.Join("tmp", "hot", "folder", "y.mov")},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			keys, matched := keysForHotFolder(tt.sourceFolder, tt.files)
			assert.Equal(t, tt.wantKeys, keys)
			assert.Equal(t, tt.wantMatched, matched)
		})
	}
}

func Test_trimHotFolderDestinationPath(t *testing.T) {
	type args struct {
		prefix string
		bucket string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "Trims s3 prefix",
			args: args{
				prefix: "s3://my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims s3 prefix and bucket",
			args: args{
				prefix: "s3://test-bucket/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims uppercase s3 prefix",
			args: args{
				prefix: "S3://my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims uppercase s3 prefix and bucket",
			args: args{
				prefix: "S3://test-bucket/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Trims leading slash",
			args: args{
				prefix: "/my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
		{
			name: "Gives back same prefix",
			args: args{
				prefix: "my-hot-folder",
				bucket: "test-bucket",
			},
			want: "my-hot-folder",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, trimHotFolderDestinationPath(tt.args.prefix, tt.args.bucket), "trimHotFolderDestinationPath(%v, %v)", tt.args.prefix, tt.args.bucket)
		})
	}
}

// Test_HotFolderUploadSourceDirectory_ForcePropagation verifies that the initial/reload
// full-folder sweep passes the hot folder's ForceInitialUpload flag straight through to the
// upload job's Force field. This guards against a regression where the sweep hardcodes Force
// (as it did before the flag was introduced), which would re-upload the whole folder on every
// daemon start regardless of the customer's setting.
func Test_HotFolderUploadSourceDirectory_ForcePropagation(t *testing.T) {
	tests := []struct {
		name               string
		forceInitialUpload bool
	}{
		{name: "flag unset -> job created with Force false", forceInitialUpload: false},
		{name: "flag set -> job created with Force true (legacy behavior)", forceInitialUpload: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hotFolder := &HotFolder{
				Name:                                  "hf",
				Enabled:                               true,
				SourceFolder:                          filepath.Join("watch", "folder"),
				ForceInitialUpload:                    tt.forceInitialUpload,
				TransferProfilesAndDestinationFolders: map[string]string{"profile": "dest"},
			}

			// Swap the production deps seam for a fake and restore it afterward.
			original := deps
			t.Cleanup(func() { deps = original })
			fake := &mockUploadDeps{}
			deps = fake

			fake.On("GetTransferProfile", "profile").
				Return(configtypes.TransferProfile{Name: "profile", Bucket: "bucket"}, nil)

			// Capture the job's Force field at NewJob time; MatchedBy also asserts it
			// equals the hot folder's ForceInitialUpload flag.
			var capturedForce bool
			fake.On("NewJob", mock.MatchedBy(func(cfg jobmanagertypes.JobConfig) bool {
				capturedForce = cfg.Force
				return cfg.Force == tt.forceInitialUpload
			})).Return(&jobmanagertypes.Job{}, nil)

			fake.On("Uploader", mock.Anything).Return()

			HotFolderUploadSourceDirectory(hotFolder)

			fake.AssertCalled(t, "NewJob", mock.MatchedBy(func(cfg jobmanagertypes.JobConfig) bool {
				return cfg.Force == tt.forceInitialUpload
			}))
			fake.AssertCalled(t, "Uploader", mock.Anything)
			assert.Equal(t, tt.forceInitialUpload, capturedForce,
				"job Force must match the hot folder's ForceInitialUpload flag")
		})
	}
}
