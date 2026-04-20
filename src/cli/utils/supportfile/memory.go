package supportfile

import (
	"math"

	"github.com/shirou/gopsutil/v4/mem"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/supportfiletypes"
	"github.com/awslabs/filemoverexpress/utils"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

func GetMemoryInformation() supportfiletypes.MemoryInfo {
	vm, err := mem.VirtualMemory()
	if err != nil {
		events.Events.Warn("Failed to retrieve virtual memory information")
		return supportfiletypes.MemoryInfo{}
	}

	// Safely convert memory total from uint64 to int64
	totalBytes, err := safeconv.Uint64ToInt64(vm.Total)
	if err != nil {
		// Log warning and use MaxInt64 as fallback for overflow cases
		events.Events.Warn("Memory total overflow detected, using MaxInt64 as fallback")
		totalBytes = math.MaxInt64
	}

	return supportfiletypes.MemoryInfo{
		Total:          utils.SizeFormat(float64(vm.Total)),
		TotalBytes:     totalBytes,
		Used:           utils.SizeFormat(float64(vm.Used)),
		UsedPercentage: vm.UsedPercent,
	}
}
