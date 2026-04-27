package systeminfo

import (
	"math"
	"runtime"
)

func GetCoreCount() int32 {
	return int32(math.Max(float64(runtime.NumCPU()-1), 1))
}
