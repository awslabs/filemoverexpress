package checksum_manager

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func TestChecksumManager_isChecksumCachedValid(t *testing.T) {
	// Use an isolated temp directory for the BoltDB database so these tests don't conflict
	// with a running daemon holding the lock on the real checksum-cache.db.
	tmpDir := t.TempDir()
	t.Setenv("FME_CONFIG_DIR", tmpDir)
	resetDatabaseSingleton()
	t.Cleanup(resetDatabaseSingleton)

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

	validFilePath := filepath.Join("..", "..", "..", "testdata", "checksums", "checksums.mhl")
	invalidFilePath := filepath.Join("..", "..", "..", "testdata", "checksums", "checksums2.mhl")

	// Derive size and checksum from the actual file on disk to avoid
	// line-ending mismatches across platforms (CRLF on Windows vs LF on Linux).
	fInfo, err := os.Stat(validFilePath)
	if err != nil {
		t.Fatalf("Failed to stat %s: %s", validFilePath, err)
	}
	validSize := fInfo.Size()

	fileBytes, err := os.ReadFile(validFilePath)
	if err != nil {
		t.Fatalf("Failed to read %s: %s", validFilePath, err)
	}
	hash := md5.Sum(fileBytes)
	validChecksum := hex.EncodeToString(hash[:])

	validModTime := time.Unix(1696362208, 0)

	err = os.Chtimes(validFilePath, validModTime, validModTime)
	if err != nil {
		t.Errorf("Failed to set mod time on %s: %s", validFilePath, err)
	}

	tests := []struct {
		name             string
		args             args
		expectedChecksum string
		wasFound         bool
		setup            func() error
		teardown         func() error
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
			expectedChecksum: validChecksum,
			wasFound:         true,
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
			expectedChecksum: "",
			wasFound:         false,
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
			expectedChecksum: "",
			wasFound:         false,
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
			expectedChecksum: "",
			wasFound:         false,
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

			cachedChecksum, found := cm.isChecksumCached(tt.args.file, tt.args.algorithm)
			if cachedChecksum != tt.expectedChecksum {
				t.Errorf("isChecksumCached() checksum = %v, want %v", cachedChecksum, tt.expectedChecksum)
			}

			if found != tt.wasFound {
				t.Errorf("isChecksumCached() found = %v, want %v", found, tt.wasFound)
			}

			if err := tt.teardown(); err != nil {
				t.Errorf("Teardown function failed: %s", err)
				return
			}
		})
	}
}
