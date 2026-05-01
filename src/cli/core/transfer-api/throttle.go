package transfer_api

import (
	"sync/atomic"
	"time"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/transferstats"
	"github.com/awslabs/filemoverexpress/types/transfertypes"
)

const (
	maxSleepTime               = float64(time.Second)
	minSleepTime               = float64(time.Millisecond)
	updateSleepTimeCount int64 = 30
	sleepAdjustmentMax         = 0.1
)

var (
	gTargetBPS        int64
	gCurrentSleepTime = int64(50 * time.Millisecond)
	isThrottling      = gTargetBPS > 0
	updateCount       int64
)

func InitThrottling() {
	gTargetBPS = int64(config.LoadConfiguration().General.TargetBandwidth) * constants.MiB
}

func GetSleepTime(direction transfertypes.Direction) time.Duration {
	targetBPS := atomic.LoadInt64(&gTargetBPS)
	if targetBPS == 0 {
		return 0
	}
	updateCount++
	if updateCount%updateSleepTimeCount != 0 {
		return time.Duration(atomic.LoadInt64(&gCurrentSleepTime))
	}

	currentSleepTime := float64(atomic.LoadInt64(&gCurrentSleepTime))
	var currentBPS int64
	if direction == transfertypes.Upload {
		currentBPS = transferstats.UploadBps()
	} else {
		currentBPS = transferstats.DownloadBps()
	}

	sleepAdjustmentFactor := float64(currentBPS-targetBPS) / float64(targetBPS)
	sleepAdjustmentFactor = min(sleepAdjustmentFactor, sleepAdjustmentMax)
	sleepAdjustmentFactor = max(sleepAdjustmentFactor, -sleepAdjustmentMax)
	sleepDelta := currentSleepTime * sleepAdjustmentFactor

	currentSleepTime += sleepDelta
	if currentSleepTime > maxSleepTime {
		currentSleepTime = maxSleepTime
	}
	if currentSleepTime <= minSleepTime {
		currentSleepTime = minSleepTime
	}

	atomic.SwapInt64(&gCurrentSleepTime, int64(currentSleepTime))
	return time.Duration(currentSleepTime)
}

func IsThrottled() bool {
	return isThrottling
}

func SetTargetBPS(bps int64) {
	isThrottling = bps > 0
	atomic.StoreInt64(&gTargetBPS, bps)
}
