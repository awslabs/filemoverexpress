package systeminfo

import (
    "math"
    "runtime"

    "github.com/spf13/viper"

    "github.com/awslabs/filemoverexpress/events"
)

// GetConcurrency sets the concurrency value for checksums and safeguards against breaking values
func GetConcurrency() int32 {
    coreCount := GetCoreCount()

    if viper.IsSet("general.max_active_checksums") {
        userConcurrency := int32(math.Max(float64(viper.GetInt("general.max_active_checksums")), 1))

        if userConcurrency > coreCount {
            events.Events.Warn(strMaxActiveChecksumsTooHigh, userConcurrency, coreCount)
            return coreCount
        }
        return userConcurrency
    }
    return coreCount
}

func GetCoreCount() int32 {
    return int32(math.Max(float64(runtime.NumCPU()-1), 1))
}
