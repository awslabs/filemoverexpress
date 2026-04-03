package supportfiletypes

type (
    SupportFile struct {
        Name string
        Body string
    }
    MachineInfo struct {
        Version   string `yaml:"version"`
        MachineId string `yaml:"machine_id"`
    }
    Limit struct {
        Type string `json:"type"`
        Soft uint64 `json:"soft"`
        Hard uint64 `json:"hard"`
    }
    MountUsage struct {
        MountPoint          string  `yaml:"mount_point"`
        TotalSpace          string  `yaml:"total_space"`
        UsedSpace           string  `yaml:"used_space"`
        UsedPercentage      float64 `yaml:"used_percentage"`
        TotalInodes         uint64  `yaml:"total_inodes"`
        UsedInodes          uint64  `yaml:"used_inodes"`
        UsedInodePercentage float64 `yaml:"used_inode_percentage"`
    }
    MemoryInfo struct {
        Total          string  `yaml:"total"`
        TotalBytes     int64   `yaml:"-"`
        Used           string  `yaml:"used"`
        UsedPercentage float64 `yaml:"used_percentage"`
    }
)
