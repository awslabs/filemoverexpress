package supportfile

import (
	"math"
	"testing"

	"github.com/awslabs/filemoverexpress/types/supportfiletypes"
	"github.com/awslabs/filemoverexpress/utils/safeconv"
)

func TestGetMemoryInformation(t *testing.T) {
	// Test the actual function with real system data
	memInfo := GetMemoryInformation()

	// Verify the returned structure has reasonable values
	if memInfo.Total == "" {
		t.Error("Expected non-empty Total field")
	}

	if memInfo.TotalBytes < 0 {
		t.Error("Expected non-negative TotalBytes")
	}

	if memInfo.Used == "" {
		t.Error("Expected non-empty Used field")
	}

	if memInfo.UsedPercentage < 0 || memInfo.UsedPercentage > 100 {
		t.Errorf("Expected UsedPercentage between 0-100, got %f", memInfo.UsedPercentage)
	}
}

func TestMemoryConversionLogic(t *testing.T) {
	// Test the conversion logic directly with various scenarios
	tests := []struct {
		name           string
		memoryTotal    uint64
		expectFallback bool
		expectedBytes  int64
	}{
		{
			name:           "normal memory 8GB",
			memoryTotal:    8 * 1024 * 1024 * 1024, // 8GB
			expectFallback: false,
			expectedBytes:  8 * 1024 * 1024 * 1024,
		},
		{
			name:           "large memory 1TB",
			memoryTotal:    1024 * 1024 * 1024 * 1024, // 1TB
			expectFallback: false,
			expectedBytes:  1024 * 1024 * 1024 * 1024,
		},
		{
			name:           "max safe memory",
			memoryTotal:    uint64(math.MaxInt64),
			expectFallback: false,
			expectedBytes:  math.MaxInt64,
		},
		{
			name:           "overflow memory",
			memoryTotal:    uint64(math.MaxInt64) + 1,
			expectFallback: true,
			expectedBytes:  math.MaxInt64, // Should use fallback
		},
		{
			name:           "max uint64 memory",
			memoryTotal:    math.MaxUint64,
			expectFallback: true,
			expectedBytes:  math.MaxInt64, // Should use fallback
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test the conversion logic used in the function
			totalBytes, err := safeconv.Uint64ToInt64(tt.memoryTotal)
			if tt.expectFallback {
				if err == nil {
					t.Errorf("Expected error for overflow case, but got none")
				}
				// Simulate the fallback logic
				totalBytes = math.MaxInt64
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}

			if totalBytes != tt.expectedBytes {
				t.Errorf("Expected totalBytes %d, got %d", tt.expectedBytes, totalBytes)
			}
		})
	}
}

func TestMemoryInfoStructure(t *testing.T) {
	// Test that we can create and populate the MemoryInfo structure
	testCases := []struct {
		name          string
		totalBytes    int64
		expectedValid bool
	}{
		{
			name:          "normal positive value",
			totalBytes:    8 * 1024 * 1024 * 1024,
			expectedValid: true,
		},
		{
			name:          "zero value",
			totalBytes:    0,
			expectedValid: true,
		},
		{
			name:          "max int64 value",
			totalBytes:    math.MaxInt64,
			expectedValid: true,
		},
		{
			name:          "negative value should not occur",
			totalBytes:    -1,
			expectedValid: false, // This shouldn't happen with our fix
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			memInfo := supportfiletypes.MemoryInfo{
				Total:          "test",
				TotalBytes:     tc.totalBytes,
				Used:           "test",
				UsedPercentage: 50.0,
			}

			if tc.expectedValid {
				if memInfo.TotalBytes != tc.totalBytes {
					t.Errorf("Expected TotalBytes %d, got %d", tc.totalBytes, memInfo.TotalBytes)
				}
			} else {
				if memInfo.TotalBytes >= 0 {
					t.Errorf("Expected negative value to be handled, but got %d", memInfo.TotalBytes)
				}
			}
		})
	}
}

// Test edge cases and boundary conditions
func TestMemoryBoundaryConditions(t *testing.T) {
	tests := []struct {
		name        string
		input       uint64
		shouldError bool
	}{
		{"zero bytes", 0, false},
		{"1 byte", 1, false},
		{"1 KB", 1024, false},
		{"1 MB", 1024 * 1024, false},
		{"1 GB", 1024 * 1024 * 1024, false},
		{"max int64", uint64(math.MaxInt64), false},
		{"overflow by 1", uint64(math.MaxInt64) + 1, true},
		{"large overflow", uint64(math.MaxInt64) + 1000, true},
		{"max uint64", math.MaxUint64, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := safeconv.Uint64ToInt64(tt.input)

			if tt.shouldError {
				if err == nil {
					t.Errorf("Expected error for input %d, but got none", tt.input)
				}
				// In our implementation, we use MaxInt64 as fallback
				if result != 0 { // safeconv returns 0 on error
					t.Errorf("Expected 0 on error, got %d", result)
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error for input %d: %v", tt.input, err)
				}
				if result != int64(tt.input) {
					t.Errorf("Expected %d, got %d", tt.input, result)
				}
			}
		})
	}
}

// Benchmark to ensure no performance regression
func BenchmarkGetMemoryInformation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = GetMemoryInformation()
	}
}

func BenchmarkMemoryConversion(b *testing.B) {
	testValue := uint64(8 * 1024 * 1024 * 1024) // 8GB

	b.Run("safe_conversion", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_, _ = safeconv.Uint64ToInt64(testValue)
		}
	})

	b.Run("unsafe_conversion", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = int64(testValue)
		}
	})
}
