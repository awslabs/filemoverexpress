package supportfile

import (
	"github.com/shirou/gopsutil/v4/disk"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/supportfiletypes"
	"github.com/awslabs/filemoverexpress/utils"
)

func GetMountPoints() []disk.PartitionStat {
	mounts, err := disk.Partitions(true)
	if err != nil {
		events.Events.Warn(err.Error())
		return nil
	}

	return mounts
}

func GetMountPointUsage(mounts []disk.PartitionStat) []supportfiletypes.MountUsage {
	mountUsages := make([]supportfiletypes.MountUsage, 0)
	for _, mount := range mounts {
		du, err := disk.Usage(mount.Mountpoint)
		if err != nil {
			events.Events.Warn(err.Error())
			continue
		}

		mountUsages = append(mountUsages, supportfiletypes.MountUsage{
			MountPoint:          mount.Mountpoint,
			TotalSpace:          utils.SizeFormat(float64(du.Total)),
			UsedSpace:           utils.SizeFormat(float64(du.Used)),
			UsedPercentage:      du.UsedPercent,
			TotalInodes:         du.InodesTotal,
			UsedInodes:          du.InodesUsed,
			UsedInodePercentage: du.InodesUsedPercent,
		})
	}

	return mountUsages
}
