package checksum_manager

import (
    "sync"

    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/types/databasetypes"
    "github.com/awslabs/filemoverexpress/utils/systeminfo"
)

var instance *ChecksumManager

func GetInstance(maxActiveChecksums int32) (*ChecksumManager, error) {
    if instance == nil {
        cpuCores := systeminfo.GetCoreCount()
        if maxActiveChecksums > cpuCores {
            events.Events.Warn(strMaxActiveChecksumsTooHigh, maxActiveChecksums, cpuCores, cpuCores)
            maxActiveChecksums = cpuCores
        }
        maxActiveChecksums = max(maxActiveChecksums, cpuCores, 1)

        db, err := databasetypes.New()
        if err != nil {
            events.Events.Error(strFailedInitializingDb, err)
            return nil, err
        }

        instance = &ChecksumManager{
            maxActiveChecksums: maxActiveChecksums,
            work:               make(chan checksumRequest, maxActiveChecksums),
            db:                 db,
            stats:              make(map[string]*checksumStatsRecord),
            statsLock:          &sync.Mutex{},
        }

        instance.startWorkers()
        go instance.progressEventEmitter()
    }

    return instance, nil
}
