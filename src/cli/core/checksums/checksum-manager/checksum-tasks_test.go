package checksum_manager

import (
    "math"
    "os"
    "testing"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/core/discovery/local_discovery"
    "github.com/awslabs/filemoverexpress/types/configtypes"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
    "github.com/awslabs/filemoverexpress/utils/safeconv"
)

var (
    ld = local_discovery.NewLocalDiscovery("", "random-id", "")

    expectedChecksums = map[string]string{
        "testdata/checksums/checksums.mhl": "cea3f0256e0564683985ab382395de35",
        "testdata/checksums/test-file-1":   "61d801940ded10755cb2641584d4a0df",
        "testdata/checksums/test-file-2":   "cf706ca8f8fee3319b8f739b85ab0444",
        "testdata/checksums/test-file-3":   "c1241921341440e5c094f440e0ceb756",
    }
)

func TestChecksumManager_ChecksumTasks(t *testing.T) {
    cwd, err := os.Getwd()
    if err != nil {
        t.Errorf("Failed getting current dir: %s", err)
        return
    }

    err = os.Chdir("../../../")
    if err != nil {
        t.Errorf("Failed changing directory: %s", err)
        return
    }

    tasks, err := getTasks()
    if err != nil {
        t.Errorf("Failed to get task list: %s", err)
        return
    }

    db, dbErr := databasetypes.New()
    if dbErr != nil {
        t.Errorf("Failed to initialize the database: %s", dbErr)
        return
    }

    defer func() {
        if cleanupErr := cleanupChecksumCache(db, tasks); cleanupErr != nil {
            t.Errorf("Failed to clean up checksum cache: %s", cleanupErr)
        }
    }()

    type fields struct {
        maxActiveChecksums int32
    }

    type args struct {
        jobId     string
        tasks     []*jobmanagertypes.Task
        checksums configtypes.ChecksumSettings
    }

    tests := []struct {
        name           string
        fields         fields
        args           args
        shouldBeCached bool
    }{
        {
            name: "Test calculating checksums with MHL",
            fields: fields{
                maxActiveChecksums: 1,
            },
            args: args{
                jobId: "job-id",
                tasks: tasks,
                checksums: configtypes.ChecksumSettings{
                    Enabled:   true,
                    Algorithm: constants.AlgorithmMD5,
                },
            },
            shouldBeCached: false,
        },
        {
            name: "Test cached checksums with MHL",
            fields: fields{
                maxActiveChecksums: 1,
            },
            args: args{
                jobId: "job-id",
                tasks: tasks,
                checksums: configtypes.ChecksumSettings{
                    Enabled:   true,
                    Algorithm: constants.AlgorithmMD5,
                },
            },
            shouldBeCached: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            cm, _ := GetInstance(tt.fields.maxActiveChecksums)
            cm.ChecksumTasks(tt.args.jobId, tt.args.tasks, tt.args.checksums)

            for _, task := range tasks {
                taskPath := task.LocalFile().Path
                checksum, found := expectedChecksums[taskPath]
                if !found {
                    t.Errorf("Missing checksum for %s", taskPath)
                    continue
                }

                if checksum != task.Checksum() {
                    t.Errorf(
                        "Mismatched checksum for %s, expected %s, got %s",
                        taskPath,
                        checksum,
                        task.Checksum(),
                    )
                    continue
                }
            }
        })
    }

    err = os.Chdir(cwd)
    if err != nil {
        t.Errorf("Failed resetting cwd: %s", err)
    }
}

func getTasks() ([]*jobmanagertypes.Task, error) {
    tasks, discoveryErrors := ld.Discover([]string{"testdata/checksums"})
    if discoveryErrors != nil {
        for _, err := range discoveryErrors {
            return nil, err
        }
    }

    return tasks, nil
}

func cleanupChecksumCache(db *databasetypes.Database, tasks []*jobmanagertypes.Task) error {
    for _, task := range tasks {
        err := db.DeleteCachedChecksum(task.LocalFile().Path)
        if err != nil {
            return err
        }
    }

    return nil
}

// TestSafeConversion_ChecksumTaskCount tests the safe conversion fix for Issue #15
func TestSafeConversion_ChecksumTaskCount(t *testing.T) {
    tests := []struct {
        name        string
        taskCount   int
        expectError bool
        expectedVal int32
        description string
    }{
        {
            name:        "Normal task count",
            taskCount:   100,
            expectError: false,
            expectedVal: 100,
            description: "Normal task count should convert safely",
        },
        {
            name:        "Maximum valid int32",
            taskCount:   math.MaxInt32,
            expectError: false,
            expectedVal: math.MaxInt32,
            description: "Maximum int32 value should convert safely",
        },
        {
            name:        "Overflow case - MaxInt32 + 1",
            taskCount:   math.MaxInt32 + 1,
            expectError: true,
            expectedVal: math.MaxInt32,
            description: "Values exceeding int32 range should trigger overflow protection",
        },
        {
            name:        "Large overflow case",
            taskCount:   int(math.MaxInt32) * 2,
            expectError: true,
            expectedVal: math.MaxInt32,
            description: "Large overflow values should be handled gracefully",
        },
        {
            name:        "Zero task count",
            taskCount:   0,
            expectError: false,
            expectedVal: 0,
            description: "Zero task count should convert safely",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test the safe conversion directly
            result, err := safeconv.IntToInt32(tt.taskCount)

            if tt.expectError {
                if err == nil {
                    t.Errorf("Expected error for task count %d but got none", tt.taskCount)
                }
                // In error cases, we use math.MaxInt32 as fallback in the actual code
                if result != 0 {
                    t.Errorf("Expected 0 on conversion error but got %d", result)
                }
            } else {
                if err != nil {
                    t.Errorf("Unexpected error for task count %d: %v", tt.taskCount, err)
                }
                if result != tt.expectedVal {
                    t.Errorf("Expected %d but got %d for task count %d", tt.expectedVal, result, tt.taskCount)
                }
            }
        })
    }
}
