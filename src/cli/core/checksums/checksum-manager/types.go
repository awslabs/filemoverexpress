package checksum_manager

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/databasetypes"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

type (
	ChecksumManager struct {
		maxActiveChecksums int32
		work               chan checksumRequest
		db                 *databasetypes.Database
		stats              map[string]*checksumStatsRecord
		statsLock          *sync.Mutex
	}

	checksumStatsRecord struct {
		jobId     string
		total     int32
		completed int32
		wg        *sync.WaitGroup
	}

	checksumRequest struct {
		jobId     string
		task      *jobmanagertypes.Task
		algorithm constants.ChecksumAlgorithm
	}

	ChecksumCacheObject struct {
		Size         int64     `json:"size"`
		LastModified time.Time `json:"last_modified"`
		Checksums    Checksum  `json:"checksums"`
		Timestamp    time.Time `json:"timestamp"`
	}

	Checksum struct {
		MD5Hex   string
		XXHash   string
		XXHash64 string
		XXH3     string
	}
)

func (csr *checksumStatsRecord) Complete() {
	atomic.AddInt32(&csr.completed, 1)
	csr.wg.Done()
}
