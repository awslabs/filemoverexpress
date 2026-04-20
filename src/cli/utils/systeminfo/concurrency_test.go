package systeminfo

import (
	"math"
	"runtime"
	"testing"

	"github.com/spf13/viper"
)

func TestGetConcurrency(t *testing.T) {
	maxCores := int32(math.Max(float64(runtime.NumCPU()-1), 1))

	mappings := map[int32]int32{
		0:    1,
		1:    1,
		2:    2,
		1000: maxCores,
	}

	for input, expected := range mappings {
		viper.SetDefault("general.max_active_checksums", input)
		c := GetConcurrency()

		if expected != c {
			t.Errorf("TestSizeFormat got unexpected value. Expected '%d', got '%d'", expected, c)
		}
	}
}
