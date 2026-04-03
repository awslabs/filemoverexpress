package local_discovery

import (
    "os"
    "reflect"
    "testing"

    "github.com/awslabs/filemoverexpress/core/discovery"
)

func TestLocalDiscovery_Discover(t *testing.T) {
    type (
        args struct {
            paths []string
        }
        expectedFiles struct {
            path        string
            size        int64
            destination string
        }
    )

    tests := []struct {
        name          string
        args          args
        prefix        string
        jobId         string
        expectedCount int
        want          []expectedFiles
        wantErrs      bool
        limitOs       string
    }{
        {
            name: "[No Prefix] Should discover the correct files",
            args: args{
                paths: []string{
                    "testdata/discovery/text-files",
                },
            },
            expectedCount: 3,
            prefix:        "",
            jobId:         discovery.StrTestJobId,
            want: []expectedFiles{
                {
                    path:        "testdata/discovery/text-files/test.txt",
                    size:        20,
                    destination: "testdata/discovery/text-files/test.txt",
                },
                {
                    path:        "testdata/discovery/text-files/another-test.txt",
                    size:        26,
                    destination: "testdata/discovery/text-files/another-test.txt",
                },
                {
                    path:        "testdata/discovery/text-files/sub-directory/empty-file.txt",
                    size:        0,
                    destination: "testdata/discovery/text-files/sub-directory/empty-file.txt",
                },
            },
            wantErrs: false,
        },
        {
            name: "[No Prefix] Providing file as source should return as expected",
            args: args{
                paths: []string{
                    "testdata/discovery/text-files/test.txt",
                },
            },
            prefix:        "",
            jobId:         "test-id",
            expectedCount: 1,
            want: []expectedFiles{
                {
                    path:        "testdata/discovery/text-files/test.txt",
                    size:        20,
                    destination: "testdata/discovery/text-files/text.txt",
                },
            },
            wantErrs: true,
        },
        {
            name: "Absolute paths should return an error",
            args: args{
                paths: []string{
                    "/testdata/discovery/text-files/test.txt",
                },
            },
            prefix:        "",
            jobId:         "test-id",
            expectedCount: 0,
            want:          nil,
            wantErrs:      true,
        },
        {
            name: "[With Prefix] Should discover the correct files",
            args: args{
                paths: []string{
                    "testdata/discovery/text-files",
                },
            },
            expectedCount: 3,
            prefix:        "my-custom-prefix",
            jobId:         "test-id",
            want: []expectedFiles{
                {
                    path:        "testdata/discovery/text-files/test.txt",
                    destination: "my-custom-prefix/testdata/discovery/test.txt",
                    size:        20,
                },
                {
                    path:        "testdata/discovery/text-files/another-test.txt",
                    destination: "my-custom-prefix/testdata/discovery/text-files/another-test.txt",
                    size:        26,
                },
                {
                    path:        "testdata/discovery/text-files/sub-directory/empty-file.txt",
                    destination: "my-custom-prefix/testdata/discovery/text-files/sub-directory/empty-file.txt",
                    size:        0,
                },
            },
            wantErrs: false,
        },
        {
            name: "[With Prefix] Providing file as source should return as expected",
            args: args{
                paths: []string{
                    "testdata/discovery/text-files/test.txt",
                },
            },
            prefix:        "my-custom-prefix",
            jobId:         "test-id",
            expectedCount: 1,
            want: []expectedFiles{
                {
                    path:        "testdata/discovery/text-files/test.txt",
                    destination: "my-custom-prefix/testdata/discovery/text-files/test.txt",
                    size:        20,
                },
            },
            wantErrs: false,
        },
        {
            name: "Non-existant source should return an error",
            args: args{
                paths: []string{"invalid-path"},
            },
            prefix:        "",
            jobId:         "test-id",
            expectedCount: 0,
            want:          nil,
            wantErrs:      true,
        },
        {
            name: "No access to source should return an error",
            args: args{
                paths: []string{"testdata/discovery/no-access/no-access.txt"},
            },
            prefix:        "",
            jobId:         "test-id",
            expectedCount: 0,
            want:          nil,
            wantErrs:      true,
            limitOs:       "linux",
        },
    }

    // TODO: LocalDiscovery has been updated to take absolute paths. Update this test to properly discover, instead of having to do any
    // directory changing
    curCwd, err := os.Getwd()
    if err != nil {
        t.Errorf("Failed getting current directory: %s", err)
    }

    err = os.Chdir("../../../")
    if err != nil {
        t.Errorf("Failed changing directory: %s", err)
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ld := &LocalDiscovery{prefix: tt.prefix, jobId: tt.jobId}
            tasks, discoveryErrors := ld.Discover(tt.args.paths)

            if tt.expectedCount != len(tasks) {
                t.Errorf(
                    "Discover() expected %d items to be returned but received %d",
                    tt.expectedCount,
                    len(tasks),
                )
            }

            for _, expected := range tt.want {
                found := false
                for _, task := range tasks {
                    if task.LocalFile().Path == expected.path && task.LocalFile().Size == expected.size {
                        found = true
                        break
                    }
                }

                if !found {
                    t.Errorf(
                        "Discover() Missing expected file %s with a size of %d",
                        expected.path,
                        expected.size,
                    )
                }
            }

            if !tt.wantErrs && (discoveryErrors != nil && len(discoveryErrors) != 0) {
                t.Errorf("Discover() expected no discovery errors, but got %d errors", len(discoveryErrors))
            }
        })
    }

    err = os.Chdir(curCwd)
    if err != nil {
        t.Errorf("Failed changing directory: %s", err)
    }
}

func TestNewLocalDiscovery(t *testing.T) {
    type args struct {
        prefix string
        jobId  string
    }

    tests := []struct {
        name string
        args args
        want LocalDiscovery
    }{
        {
            name: "[No Prefix] Should return an instance without a prefix",
            args: args{
                prefix: "",
                jobId:  "test-id",
            },
            want: LocalDiscovery{
                prefix: "",
                jobId:  "test-id",
            },
        },
        {
            name: "[With Prefix] Should return an instance with prefix set",
            args: args{
                prefix: "my-custom-prefix",
                jobId:  "test-id",
            },
            want: LocalDiscovery{
                prefix: "my-custom-prefix",
                jobId:  "test-id",
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := NewLocalDiscovery(tt.args.prefix, tt.args.jobId, ""); !reflect.DeepEqual(got, tt.want) {
                t.Errorf("NewLocalDiscovery() = %v, want %v", got, tt.want)
            }
        })
    }
}
