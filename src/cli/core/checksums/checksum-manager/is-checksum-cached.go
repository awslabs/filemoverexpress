package checksum_manager

import (
    "errors"
    "os"
    "path/filepath"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
    ftErrors "github.com/awslabs/filemoverexpress/fme-errors"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func (cm *ChecksumManager) isChecksumCached(file jobmanagertypes.LocalFile, algorithm constants.ChecksumAlgorithm) (string, bool) {
    absPath, err := filepath.Abs(file.Path)
    if err != nil {
        events.Events.Error("Failed to get absolute path for %s: %s", file.Path, err)
        return "", false
    }

    cachedChecksum, cacheErr := cm.db.GetCachedChecksum(absPath)
    if cacheErr != nil {
        if errors.Is(cacheErr, ftErrors.ErrChecksumNotCached) {
            return "", false
        }

        events.Events.Warn(strChecksumLookupError, cacheErr)
        return "", false
    }

    fInfo, err := os.Stat(file.Path)
    if err != nil {
        if os.IsNotExist(err) {
            logger.Debug("Removing orphaned checksum cache entry for %s", file.Path)
            if delErr := cm.db.DeleteCachedChecksum(absPath); delErr != nil {
                logger.Debug("Failed to remove orphaned checksum cache entry: %s", delErr)
            }
        }
        return "", false
    }

    if cachedChecksum.Size != fInfo.Size() || cachedChecksum.LastModified.Unix() != fInfo.ModTime().Unix() {
        logger.Debug("File on disk has changed since checksum was cached, removing entry for %s", file.Path)

        if delErr := cm.db.DeleteCachedChecksum(absPath); delErr != nil {
            logger.Debug("Failed to remove expired checksum cache entry: %s", delErr)
        }

        return "", false
    }

    switch algorithm {
    case constants.AlgorithmMD5:
        if cachedChecksum.MD5Hex != "" {
            return cachedChecksum.MD5Hex, true
        }
    case "xxhash":
        if cachedChecksum.XXHash != "" {
            return cachedChecksum.XXHash, true
        }
    case "xxhash64":
        if cachedChecksum.XXHash64 != "" {
            return cachedChecksum.XXHash64, true
        }
    case "xxh3":
        if cachedChecksum.XXH3 != "" {
            return cachedChecksum.XXH3, true
        }
    default:
        logger.Warn("Received an unsupported checksum algorithm: %s", algorithm)
    }

    return "", false
}
