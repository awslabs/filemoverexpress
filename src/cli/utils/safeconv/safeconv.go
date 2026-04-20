package safeconv

import (
	"fmt"
	"math"
)

// Uint64ToInt64 safely converts uint64 to int64
func Uint64ToInt64(v uint64) (int64, error) {
	if v > math.MaxInt64 {
		return 0, fmt.Errorf("value %d exceeds max int64", v)
	}
	return int64(v), nil
}

// Uint64ToInt safely converts uint64 to int
func Uint64ToInt(v uint64) (int, error) {
	if v > math.MaxInt {
		return 0, fmt.Errorf("value %d exceeds max int", v)
	}
	return int(v), nil
}

// IntToUint64 safely converts int to uint64
func IntToUint64(v int) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("cannot convert negative int %d to uint64", v)
	}
	return uint64(v), nil
}

// Int64ToUint64 safely converts int64 to uint64
func Int64ToUint64(v int64) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("cannot convert negative int64 %d to uint64", v)
	}
	return uint64(v), nil
}

// IntToInt32 safely converts int to int32
func IntToInt32(v int) (int32, error) {
	if v > math.MaxInt32 || v < math.MinInt32 {
		return 0, fmt.Errorf("value %d outside int32 range", v)
	}
	return int32(v), nil
}

// Int32ToUint64 safely converts int32 to uint64
func Int32ToUint64(v int32) (uint64, error) {
	if v < 0 {
		return 0, fmt.Errorf("cannot convert negative int32 %d to uint64", v)
	}
	return uint64(v), nil
}

// IntToInt8 safely converts int to int8
func IntToInt8(v int) (int8, error) {
	if v > math.MaxInt8 || v < math.MinInt8 {
		return 0, fmt.Errorf("value %d outside int8 range", v)
	}
	return int8(v), nil
}

// Float64ToInt32 safely converts float64 to int32
func Float64ToInt32(v float64) (int32, error) {
	if v > math.MaxInt32 || v < math.MinInt32 {
		return 0, fmt.Errorf("value %f outside int32 range", v)
	}
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0, fmt.Errorf("invalid float64 value: %f", v)
	}
	return int32(v), nil
}
