package systeminfo

import "testing"

func TestAutoMATFromLimits(t *testing.T) {
	cases := []struct {
		name   string
		cores  int
		fdSoft uint64
		want   int
	}{
		{"8 cores, ample fds", 8, 65535, 256},           // 8*32=256, fd budget huge -> ceiling
		{"64 cores capped at ceiling", 64, 65535, 256},  // 2048 -> 256
		{"8 cores, low fd limit caps it", 8, 1024, 51},  // 1024*80/100/16 = 51 < 256
		{"single core -> core-scaled", 1, 65535, 32},    // 1*32
		{"2 cores", 2, 65535, 64},                       // 2*32
		{"no fd info falls back to core scaling", 8, 0, 256},
		{"tiny fd honors floor", 1, 128, 16}, // budget 6 < floor 16
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := autoMATFromLimits(tc.cores, tc.fdSoft)
			if got != tc.want {
				t.Errorf("autoMATFromLimits(%d, %d) = %d, want %d", tc.cores, tc.fdSoft, got, tc.want)
			}
			if got < 16 || got > 256 {
				t.Errorf("result %d outside [16,256]", got)
			}
		})
	}
}
