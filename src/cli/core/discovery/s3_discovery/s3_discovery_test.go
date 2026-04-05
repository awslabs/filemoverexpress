package s3_discovery

import (
    "errors"
    "path/filepath"
    "reflect"
    "sync"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"

    "github.com/awslabs/filemoverexpress/core/discovery"
    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/core/transfer-api/mock"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

var mocks3m = transferapi.S3Manager{
    AwsProfile: mock.UniteTestMockAWSProfile,
    Bucket:     mock.UnitTestMockBucket,
    Client:     &mock.FileMoverS3Client{},
    Region:     mock.UnitTestMockRegion,
    Lock:       &sync.RWMutex{},
}

func TestS3Discovery_Discover(t *testing.T) {
    lastModifiedForFilePathWithPrefix, _ := time.Parse(time.RFC3339, mock.UnitTestLastModifiedForFilePathWithPrefix)

    type fields struct {
        destinationFolder string
        prefix            string
        jobId             string
    }
    type args struct {
        s3Prefixes []string
        s3Manager  transferapi.S3Manager
    }
    type expectedTasks struct {
        Destination   string
        s3Object      jobmanagertypes.S3Object
        JobId         string
        TaskDirection jobmanagertypes.TaskDirection
    }

    tests := []struct {
        name          string
        fields        fields
        args          args
        expectedCount int
        want          []expectedTasks
        wantErrs      bool
    }{
        {
            name: "Should discover the correct s3 paths for the folder s3Prefix input without Prefix and destination",
            args: args{
                s3Prefixes: []string{
                    mock.UnitTestFolderPrefix,
                },
                s3Manager: mocks3m,
            },
            expectedCount: 1,
            fields: fields{
                destinationFolder: "",
                prefix:            "",
                jobId:             discovery.StrTestJobId,
            },

            want: []expectedTasks{
                {
                    Destination: filepath.FromSlash(mock.UnitTestFileNameWithPrefix),
                    s3Object: jobmanagertypes.S3Object{
                        Key:          mock.UnitTestFileNameWithPrefix,
                        LastModified: lastModifiedForFilePathWithPrefix,
                        Size:         1048576,
                    },
                    JobId:         discovery.StrTestJobId,
                    TaskDirection: jobmanagertypes.TaskDirectionDownload,
                },
            },
            wantErrs: false,
        },
        {
            name: "Should discover the correct s3 paths for the s3 object path as S3Prefix input without Prefix and destination",
            args: args{
                s3Prefixes: []string{
                    mock.UnitTestFileNameWithPrefix,
                },
                s3Manager: mocks3m,
            },
            expectedCount: 1,
            fields: fields{
                destinationFolder: "",
                prefix:            "",
                jobId:             discovery.StrTestJobId,
            },

            want: []expectedTasks{
                {
                    Destination: filepath.FromSlash(mock.UnitTestFileNameWithPrefix),
                    s3Object: jobmanagertypes.S3Object{
                        Key:          mock.UnitTestFileNameWithPrefix,
                        LastModified: lastModifiedForFilePathWithPrefix,
                        Size:         1048576,
                    },
                    JobId:         discovery.StrTestJobId,
                    TaskDirection: jobmanagertypes.TaskDirectionDownload,
                },
            },
            wantErrs: false,
        },
        {
            name: "Should discover the correct s3 paths with valid Prefix and Destination Folder",
            args: args{
                s3Prefixes: []string{
                    mock.UnitTestFolderPrefix,
                },
                s3Manager: mocks3m,
            },
            expectedCount: 1,
            fields: fields{
                destinationFolder: discovery.StrTestDestinationFolder,
                prefix:            discovery.StrTestPrefix,
                jobId:             discovery.StrTestJobId,
            },

            want: []expectedTasks{
                {
                    Destination: filepath.Join(discovery.StrTestPrefix, discovery.StrTestDestinationFolder, mock.UnitTestFileNameWithPrefix),
                    s3Object: jobmanagertypes.S3Object{
                        Key:          mock.UnitTestFileNameWithPrefix,
                        LastModified: lastModifiedForFilePathWithPrefix,
                        Size:         1048576,
                    },
                    JobId:         discovery.StrTestJobId,
                    TaskDirection: jobmanagertypes.TaskDirectionDownload,
                },
            },
            wantErrs: false,
        },
        {
            name: "Should discover the correct s3 paths without duplication with destination",
            args: args{
                s3Prefixes: []string{
                    mock.UnitTestFolderPrefix,
                    mock.UnitTestFileNameWithPrefix,
                },
                s3Manager: mocks3m,
            },
            expectedCount: 1,
            fields: fields{
                destinationFolder: discovery.StrTestDestinationFolder,
                prefix:            discovery.StrTestPrefix,
                jobId:             discovery.StrTestJobId,
            },

            want: []expectedTasks{
                {
                    Destination: filepath.Join(discovery.StrTestPrefix, discovery.StrTestDestinationFolder, mock.UnitTestFileNameWithPrefix),
                    s3Object: jobmanagertypes.S3Object{
                        Key:          mock.UnitTestFileNameWithPrefix,
                        LastModified: lastModifiedForFilePathWithPrefix,
                        Size:         1048576,
                    },
                    JobId:         discovery.StrTestJobId,
                    TaskDirection: jobmanagertypes.TaskDirectionDownload,
                },
            },
            wantErrs: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            s3d := &S3Discovery{
                destinationFolder: tt.fields.destinationFolder,
                prefix:            tt.fields.prefix,
                jobId:             tt.fields.jobId,
            }
            tasks, errs := s3d.Discover(tt.args.s3Prefixes, tt.args.s3Manager, s3d)
            if tt.expectedCount != len(tasks) {
                t.Errorf("S3 Discover() expected %d items to be returned but received %d",
                    tt.expectedCount,
                    len(tasks))
            }

            for _, expected := range tt.want {
                found := false
                for _, task := range tasks {
                    if task.Destination() == expected.Destination {
                        if !reflect.DeepEqual(task.S3Object(), expected.s3Object) {
                            t.Errorf("task s3 object got = %v, expected %v", task.S3Object(), expected.s3Object)
                        }
                        assert.Equal(t, expected.JobId, task.JobId())
                        assert.Equal(t, expected.TaskDirection, task.TaskDirection())
                        found = true
                        break
                    }
                }
                if !found {
                    t.Errorf("Discover() Missing expected destination %s",
                        expected.Destination)
                }
            }
            if !tt.wantErrs && errs != nil && (len(errs) != 0) {
                t.Errorf("Discover() expected no discovery errors, but got %d errors", len(errs))
            }
        })
    }
}

type MockStruct struct{}

func (m *MockStruct) calculateDestination(_ string) (string, error) {
    return "", errors.New("this is a mocking error for calculateDestination method")
}

func TestS3Discovery_Discover_ShouldStoreCalculateDestinationRError(t *testing.T) {
    s3Prefixes := []string{
        mock.UnitTestFolderPrefix,
    }
    s3m := mocks3m
    s3d := S3Discovery{
        destinationFolder: discovery.StrTestDestinationFolder,
        prefix:            "",
        jobId:             discovery.StrTestJobId,
    }
    _, errs := s3d.Discover(s3Prefixes, s3m, &MockStruct{})

    assert.True(t, len(errs) == 1)
    assert.ErrorContains(t, errs[0], "this is a mocking error")

}

func TestS3Discovery_calculateDestination(t *testing.T) {
    type fields struct {
        destinationFolder string
        prefix            string
        jobId             string
    }
    type args struct {
        s3key string
    }
    tests := []struct {
        name   string
        fields fields
        args   args
        want   string
    }{
        {
            name: "With valid prefix, destination folder and s3key should return expected folder path",
            fields: fields{
                destinationFolder: discovery.StrTestDestinationFolder,
                prefix:            discovery.StrTestPrefix,
                jobId:             discovery.StrTestJobId,
            },
            args: args{
                s3key: mock.UnitTestFolderPrefix,
            },
            want: filepath.Join(discovery.StrTestPrefix, discovery.StrTestDestinationFolder, mock.UnitTestFolderPrefix) + sep,
        },
        {
            name: "With empty prefix, valid destination folder and s3key should return expected file path",
            fields: fields{
                destinationFolder: discovery.StrTestDestinationFolder,
                prefix:            discovery.StrTestPrefix,
                jobId:             discovery.StrTestJobId,
            },
            args: args{
                s3key: mock.UnitTestFileNameWithPrefix,
            },
            want: filepath.Join(discovery.StrTestPrefix, discovery.StrTestDestinationFolder, mock.UnitTestFileNameWithPrefix),
        },
        {
            name: "With empty prefix, valid destination folder and s3key should return expected path",
            fields: fields{
                destinationFolder: discovery.StrTestDestinationFolder,
                prefix:            "",
                jobId:             discovery.StrTestJobId,
            },
            args: args{
                s3key: mock.UnitTestFolderPrefix,
            },
            want: filepath.Join(discovery.StrTestDestinationFolder, mock.UnitTestFolderPrefix) + sep,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            s3d := &S3Discovery{
                destinationFolder: tt.fields.destinationFolder,
                prefix:            tt.fields.prefix,
                jobId:             tt.fields.jobId,
            }
            destination, err := s3d.calculateDestination(tt.args.s3key)
            if err != nil {
                t.Errorf("calculateDestination() expected no error, but got err")
            }
            assert.Equalf(t, tt.want, destination, "calculateDestination(%v)", tt.args.s3key)
        })
    }
}

/**
TODO: Due to the release deadline,
we de-prioritize the test coverages which need our mocking method to support more customized ListObjects
instead of/only return the successful one.
1. Test Glacier storage class is ignored
2. Test listObjects returns empty list
3. Test ListObjects returns err
**/

func Test_sanitizeS3ObjectName(t *testing.T) {
    type args struct {
        name              string
        invalidCharacters []string
    }
    var defaultUnixCharacters = []string{"/../", "../", "/.."}
    var defaultWindowsCharacters = []string{"\\..\\", "..\\", "\\.."}

    tests := []struct {
        name string
        args args
        want string
    }{
        {
            name: "No sanitizing needed, unix",
            args: args{
                name:              "valid/file.txt",
                invalidCharacters: defaultUnixCharacters,
            },
            want: "valid/file.txt",
        },
        {
            name: "No sanitizing needed, windows",
            args: args{
                name:              "valid/file.txt",
                invalidCharacters: defaultWindowsCharacters,
            },
            want: "valid/file.txt",
        },
        {
            name: "Contains embedded parent dir, unix",
            args: args{
                name:              "invalid/../file.txt",
                invalidCharacters: defaultUnixCharacters,
            },
            want: "invalid_file.txt",
        },
        {
            name: "Contains beginning parent dir, unix",
            args: args{
                name:              "../file.txt",
                invalidCharacters: defaultUnixCharacters,
            },
            want: "_file.txt",
        },
        {
            name: "Contains ending parent dir, unix",
            args: args{
                name:              "file.txt/..",
                invalidCharacters: defaultUnixCharacters,
            },
            want: "file.txt_",
        },
        {
            name: "Contains embedded parent dir, windows",
            args: args{
                name:              "invalid\\..\\file.txt",
                invalidCharacters: defaultWindowsCharacters,
            },
            want: "invalid_file.txt",
        },
        {
            name: "Contains beginning parent dir, windows",
            args: args{
                name:              "..\\file.txt",
                invalidCharacters: defaultWindowsCharacters,
            },
            want: "_file.txt",
        },
        {
            name: "Contains ending parent dir, windows",
            args: args{
                name:              "file.txt\\..",
                invalidCharacters: defaultWindowsCharacters,
            },
            want: "file.txt_",
        },
        // TODO: Add test cases.
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            assert.Equalf(t, tt.want, sanitizeS3ObjectName(tt.args.name, tt.args.invalidCharacters), "sanitizeS3ObjectName(%v, %v)", tt.args.name, tt.args.invalidCharacters)
        })
    }
}
