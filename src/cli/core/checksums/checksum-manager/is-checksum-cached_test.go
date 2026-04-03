package checksum_manager

import (
    "fmt"
    "os"
    "runtime"
    "sync"
    "testing"
    "time"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func TestChecksumManager_isChecksumCachedValid(t *testing.T) {
    type (
        args struct {
            file      jobmanagertypes.LocalFile
            algorithm constants.ChecksumAlgorithm
        }
    )

    db, dbErr := databasetypes.New()
    if dbErr != nil {
        t.Errorf("Failed opening database: %s", dbErr)
        return
    }

    validFilePath := "../../../testdata/checksums/checksums.mhl"
    invalidFilePath := "../../../testdata/checksums/checksums2.mhl"
    validSize := int64(1059)
    validModTime := time.Unix(1696362208, 0)
    validChecksum := "cea3f0256e0564683985ab382395de35"

    err := os.Chtimes(validFilePath, validModTime, validModTime)
    if err != nil {
        t.Errorf("Failed to set mod time on %s: %s", validFilePath, err)
    }

    tests := []struct {
        name     string
        args     args
        want     string
        want1    bool
        setup    func() error
        teardown func() error
    }{
        {
            name: "Test valid file with valid properties",
            args: args{
                file: jobmanagertypes.LocalFile{
                    Path:         validFilePath,
                    Size:         validSize,
                    LastModified: validModTime,
                },
                algorithm: constants.AlgorithmMD5,
            },
            want:  validChecksum,
            want1: true,
            setup: func() error {
                err := db.StoreChecksumCache(validFilePath, databasetypes.ChecksumRecord{
                    LastModified: validModTime,
                    Size:         validSize,
                    MD5Hex:       validChecksum,
                })
                if err != nil {
                    return fmt.Errorf("failed storing checksum for test: %w", err)
                }
                time.Sleep(5 * time.Second)

                return nil
            },
            teardown: func() error {
                err := db.DeleteCachedChecksum(validFilePath)
                if err != nil {
                    return fmt.Errorf("failed removing checksum for test: %w", err)
                }

                return nil
            },
        },
        {
            name: "Test valid file with modified size",
            args: args{
                file: jobmanagertypes.LocalFile{
                    Path:         validFilePath,
                    Size:         validSize,
                    LastModified: validModTime,
                },
                algorithm: constants.AlgorithmMD5,
            },
            want:  "",
            want1: false,
            setup: func() error {
                err := db.DeleteCachedChecksum(validFilePath)
                if err != nil {
                    return fmt.Errorf("failed removing checksum for test: %w", err)
                }

                err = db.StoreChecksumCache(validFilePath, databasetypes.ChecksumRecord{
                    LastModified: validModTime,
                    Size:         validSize + 1,
                    MD5Hex:       validChecksum,
                })
                if err != nil {
                    return fmt.Errorf("failed storing checksum for test: %w", err)
                }

                return nil
            },
            teardown: func() error {
                err := db.DeleteCachedChecksum(validFilePath)
                if err != nil {
                    return fmt.Errorf("failed removing checksum for test: %w", err)
                }

                return nil
            },
        },
        {
            name: "Test valid cache with missing file",
            args: args{
                file: jobmanagertypes.LocalFile{
                    Path:         invalidFilePath,
                    Size:         validSize,
                    LastModified: validModTime,
                },
                algorithm: constants.AlgorithmMD5,
            },
            want:  "",
            want1: false,
            setup: func() error {
                err := db.StoreChecksumCache(invalidFilePath, databasetypes.ChecksumRecord{
                    LastModified: validModTime,
                    Size:         validSize,
                    MD5Hex:       validChecksum,
                })
                if err != nil {
                    return fmt.Errorf("failed storing checksum for test: %w", err)
                }

                return nil
            },
            teardown: func() error {
                err := db.DeleteCachedChecksum(invalidFilePath)
                if err != nil {
                    return fmt.Errorf("failed removing checksum for test: %w", err)
                }

                return nil
            },
        },
        {
            name: "Test valid file without a cache entry",
            args: args{
                file: jobmanagertypes.LocalFile{
                    Path:         validFilePath,
                    Size:         validSize,
                    LastModified: validModTime,
                },
                algorithm: constants.AlgorithmMD5,
            },
            want:  "",
            want1: false,
            setup: func() error {
                return nil
            },
            teardown: func() error {
                //err := db.DeleteCachedChecksum(validFilePath)
                //if err != nil {
                //	return fmt.Errorf("Failed removing checksum for test: %w", err)
                //}

                return nil
            },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if err := tt.setup(); err != nil {
                t.Errorf("Setup function failed: %s", err)
                return
            }

            cm := &ChecksumManager{
                maxActiveChecksums: int32(runtime.NumCPU()),
                work:               make(chan checksumRequest),
                db:                 db,
                stats:              make(map[string]*checksumStatsRecord),
                statsLock:          &sync.Mutex{},
            }

            got, got1 := cm.isChecksumCached(tt.args.file, tt.args.algorithm)
            if got != tt.want {
                t.Errorf("isChecksumCached() checksum = %v, want %v", got, tt.want)
            }

            if got1 != tt.want1 {
                t.Errorf("isChecksumCached() found = %v, want %v", got1, tt.want1)
            }

            if err := tt.teardown(); err != nil {
                t.Errorf("Teardown function failed: %s", err)
                return
            }
        })
    }
}
