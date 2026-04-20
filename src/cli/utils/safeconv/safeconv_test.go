package safeconv

import (
	"math"
	"testing"
)

func TestUint64ToInt64(t *testing.T) {
	tests := []struct {
		name    string
		input   uint64
		want    int64
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"one", 1, 1, false},
		{"small value", 1000, 1000, false},
		{"mid-range", uint64(1 << 32), 1 << 32, false},
		{"large valid", uint64(1 << 62), 1 << 62, false},
		{"max safe", uint64(math.MaxInt64), math.MaxInt64, false},

		// Overflow cases
		{"just over max", uint64(math.MaxInt64) + 1, 0, true},
		{"high value", uint64(1 << 63), 0, true},
		{"max uint64", math.MaxUint64, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Uint64ToInt64(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Uint64ToInt64() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("Uint64ToInt64() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUint64ToInt(t *testing.T) {
	tests := []struct {
		name    string
		input   uint64
		want    int
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"one", 1, 1, false},
		{"small value", 1000, 1000, false},
		{"mid-range", uint64(1 << 20), 1 << 20, false},

		// Architecture-dependent tests
		{"max int", uint64(math.MaxInt), math.MaxInt, false},
		{"over max int", uint64(math.MaxInt) + 1, 0, true},
		{"max uint64", math.MaxUint64, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Uint64ToInt(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Uint64ToInt() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("Uint64ToInt() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIntToUint64(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		want    uint64
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"positive", 1000, 1000, false},
		{"large positive", math.MaxInt, uint64(math.MaxInt), false},

		// Invalid cases
		{"negative small", -1, 0, true},
		{"negative large", -1000, 0, true},
		{"min int", math.MinInt, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := IntToUint64(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("IntToUint64() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("IntToUint64() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInt64ToUint64(t *testing.T) {
	tests := []struct {
		name    string
		input   int64
		want    uint64
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"positive", 1000, 1000, false},
		{"max int64", math.MaxInt64, uint64(math.MaxInt64), false},

		// Invalid cases
		{"negative small", -1, 0, true},
		{"negative large", -1000, 0, true},
		{"min int64", math.MinInt64, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Int64ToUint64(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Int64ToUint64() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("Int64ToUint64() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIntToInt32(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		want    int32
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"positive", 1000, 1000, false},
		{"negative", -1000, -1000, false},
		{"max int32", math.MaxInt32, math.MaxInt32, false},
		{"min int32", math.MinInt32, math.MinInt32, false},

		// Overflow cases (architecture dependent)
		{"over max int32", math.MaxInt32 + 1, 0, true},
		{"under min int32", math.MinInt32 - 1, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Skip overflow tests on 32-bit systems where int == int32
			if (tt.name == "over max int32" || tt.name == "under min int32") &&
				(math.MaxInt == math.MaxInt32) {
				t.Skip("Skipping overflow test on 32-bit system")
			}

			got, err := IntToInt32(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("IntToInt32() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("IntToInt32() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInt32ToUint64(t *testing.T) {
	tests := []struct {
		name    string
		input   int32
		want    uint64
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"positive", 1000, 1000, false},
		{"max int32", math.MaxInt32, uint64(math.MaxInt32), false},

		// Invalid cases
		{"negative small", -1, 0, true},
		{"negative large", -1000, 0, true},
		{"min int32", math.MinInt32, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Int32ToUint64(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Int32ToUint64() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("Int32ToUint64() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIntToInt8(t *testing.T) {
	tests := []struct {
		name    string
		input   int
		want    int8
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0, 0, false},
		{"positive small", 100, 100, false},
		{"negative small", -100, -100, false},
		{"max int8", 127, 127, false},
		{"min int8", -128, -128, false},

		// Overflow cases
		{"over max", 128, 0, true},
		{"under min", -129, 0, true},
		{"large positive", 1000, 0, true},
		{"large negative", -1000, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := IntToInt8(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("IntToInt8() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("IntToInt8() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFloat64ToInt32(t *testing.T) {
	tests := []struct {
		name    string
		input   float64
		want    int32
		wantErr bool
	}{
		// Valid range tests
		{"zero", 0.0, 0, false},
		{"positive", 1000.0, 1000, false},
		{"negative", -1000.0, -1000, false},
		{"max int32", float64(math.MaxInt32), math.MaxInt32, false},
		{"min int32", float64(math.MinInt32), math.MinInt32, false},
		{"positive fraction", 1000.5, 1000, false},
		{"negative fraction", -1000.5, -1000, false},

		// Overflow cases
		{"over max int32", float64(math.MaxInt32) + 1, 0, true},
		{"under min int32", float64(math.MinInt32) - 1, 0, true},
		{"large positive", 1e10, 0, true},
		{"large negative", -1e10, 0, true},

		// Invalid float cases
		{"NaN", math.NaN(), 0, true},
		{"positive infinity", math.Inf(1), 0, true},
		{"negative infinity", math.Inf(-1), 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Float64ToInt32(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("Float64ToInt32() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("Float64ToInt32() = %v, want %v", got, tt.want)
			}
		})
	}
}

// Benchmark tests to ensure no performance regression
func BenchmarkUint64ToInt64(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = Uint64ToInt64(uint64(i))
	}
}

func BenchmarkIntToInt32(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = IntToInt32(i)
	}
}

func BenchmarkIntToInt8(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = IntToInt8(i % 256)
	}
}

func BenchmarkFloat64ToInt32(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _ = Float64ToInt32(float64(i))
	}
}
