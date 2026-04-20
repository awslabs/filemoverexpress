package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestStringArrayContains(t *testing.T) {
	testList := []string{"Hello", "world"}

	validResult := StringArrayContains(testList, "Hello")
	if !validResult {
		t.Error("StringArrayContains failed, expected true, got false")
	}

	invalidResult := StringArrayContains(testList, "invalid")
	if invalidResult {
		t.Error("StringArrayContains failed, expected false, got true")
	}
}

func TestParseTimeRange(t *testing.T) {
	testList := map[string]int64{
		"":   0,
		"0":  0,
		"1":  1,
		"1m": 60,
		"1h": 3600,
		"1d": 86400,
	}

	for k, v := range testList {
		res, err := ParseTimeRange(k)
		if err != nil {
			t.Errorf("TestParseTimeRange failed parsing %s: %s", k, err)
			continue
		}

		if res != v {
			t.Errorf("TestParseTimeRange failed parsing %s. Expected %d, got %d", k, v, res)
		}
	}
}

func TestParseTimeRangeInvalid(t *testing.T) {
	testList := []string{
		"1k",
		"invalid",
		"2147483648",
	}

	for _, k := range testList {
		_, err := ParseTimeRange(k)
		if err == nil {
			t.Errorf("TestParseTimeRangeInvalid should have failed parsing, but succeeded %s", k)
		}
	}
}

func TestSha256Hash(t *testing.T) {
	expected := "cf80cd8aed482d5d1527d7dc72fceff84e6326592848447d2dc0b0e87dfc9a90"
	sha, err := Sha256Hash("testing")
	if err != nil {
		t.Errorf("TestSha256Hash Reveived an unexpected error from Sha256Hash function %s", err)
	}
	assert.Equal(t, expected, sha)
}

func TestIsValidUUID(t *testing.T) {
	assert.True(t, IsValidUUID("0569426f-b9db-5c8a-bf6c-6dbbd6aff5aa"))

	assert.False(t, IsValidUUID("0569426fb9db5c8abf6c6dbbd6aff5aa"))
	assert.False(t, IsValidUUID("asdfasdfsadfsdf"))
}

func TestCleanPrefix(t *testing.T) {
	type args struct {
		delimiter string
		inputs    []string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		{
			name: "should handle empty input",
			args: args{
				delimiter: "/",
				inputs:    []string{""},
			},
			want: "",
		},
		{
			name: "should handle slash only",
			args: args{
				delimiter: "/",
				inputs:    []string{"/"},
			},
			want: "",
		},
		{
			name: "should handle multiple slashes",
			args: args{
				delimiter: "/",
				inputs:    []string{"/", "//"},
			},
			want: "",
		},
		{
			name: "should not remove trailing slashes",
			args: args{
				delimiter: "/",
				inputs:    []string{"prefix", "subfolder//"},
			},
			want: "prefix/subfolder/",
		},
		{
			name: "should remove leading slashes",
			args: args{
				delimiter: "/",
				inputs:    []string{"/prefix", "//subfolder//"},
			},
			want: "prefix/subfolder/",
		},
		{
			name: "should remove leading slashes when there is only one input",
			args: args{
				delimiter: "/",
				inputs:    []string{"///prefix/subfolder"},
			},
			want: "prefix/subfolder/",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equalf(t, tt.want, CleanPrefix(tt.args.delimiter, tt.args.inputs...), "CleanPrefix(%v, %v)", tt.args.delimiter, tt.args.inputs)
		})
	}
}

func TestSizeFormat(t *testing.T) {
	sizes := map[float64]string{
		1000:                "1000.00 B",
		1500:                "1.5 KiB",
		2500000:             "2.4 MiB",
		2500000000:          "2.3 GiB",
		2500000000000:       "2.3 TiB",
		2500000000000000:    "2.2 PiB",
		2500000000000000000: "2.2 EiB",
	}

	for size, expected := range sizes {
		s := SizeFormat(size)
		if s != expected {
			t.Errorf("TestSizeFormat got unexpected value. Expected '%s', got '%s'", expected, s)
		}
	}
}
