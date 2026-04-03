package checksum_manager

import (
    "time"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/core/checksums"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

func (cm *ChecksumManager) startWorkers() {
    for i := int32(1); i <= cm.maxActiveChecksums; i++ {
        go cm.checksumWorker()
    }
}

func (cm *ChecksumManager) processRequest(request checksumRequest) {
    request.task.SetStatus(jobmanagertypes.TaskStatusChecksumming)
    checksummer, err := checksums.NewChecksummer(request.algorithm)
    if err != nil {
        cm.processChecksumError(request, err)
        return
    }

    checksum, err := checksummer.ChecksumFile(request.task.LocalFile().Path)
    if err != nil {
        cm.processChecksumError(request, err)
        return
    }
    request.task.SetChecksum(checksum)

    if request.algorithm != constants.AlgorithmNone {
        cache := createCacheRecord(request.task.LocalFile(), checksum, request.algorithm)
        cacheErr := cm.db.StoreChecksumCache(request.task.LocalFile().Path, cache)
        if cacheErr != nil {
            events.Events.Warn("Failed storing checksum cache: %s", cacheErr)
        }
    }

    cm.statsLock.Lock()
    cm.stats[request.jobId].completed++
    cm.stats[request.jobId].wg.Done()
    cm.statsLock.Unlock()
}

func (cm *ChecksumManager) processChecksumError(request checksumRequest, err error) {
    events.Events.Error(
        "Failed to checksum file %s: %s",
        request.task.LocalFile().Path,
        err.Error(),
    )
    request.task.SetStatusAndError(jobmanagertypes.TaskStatusError, err)
    cm.statsLock.Lock()
    cm.stats[request.jobId].completed++
    cm.stats[request.jobId].wg.Done()
    cm.statsLock.Unlock()
}

func (cm *ChecksumManager) checksumWorker() {
    for request := range cm.work {
        cm.processRequest(request)
    }
}

func (cm *ChecksumManager) progressEventEmitter() {
    for {
        <-time.After(time.Second * 2)

        cm.statsLock.Lock()
        for jobId := range cm.stats {
            completed := cm.stats[jobId].completed
            total := cm.stats[jobId].total

            if completed == total {
                continue
            }

            events.Events.Send(&eventtypes.JobChecksumProgressEvent{
                JobId:     jobId,
                Total:     total,
                Completed: completed,
            })
        }
        cm.statsLock.Unlock()
    }
}

func createCacheRecord(
    fileInfo jobmanagertypes.LocalFile,
    checksum string,
    algorithm constants.ChecksumAlgorithm,
) databasetypes.ChecksumRecord {
    checksumRecord := databasetypes.ChecksumRecord{
        Size:         fileInfo.Size,
        LastModified: fileInfo.LastModified,
    }
    switch algorithm {
    case constants.AlgorithmMD5:
        checksumRecord.MD5Hex = checksum
    case constants.AlgorithmXXHash64:
        checksumRecord.XXHash64 = checksum
    case constants.AlgorithmXXH3:
        checksumRecord.XXH3 = checksum
    default:
        checksumRecord.XXHash = checksum
    }
    return checksumRecord
}
