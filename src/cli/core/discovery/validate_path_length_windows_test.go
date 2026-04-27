package discovery

import (
	"math/rand/v2"
	"strings"
	"testing"

	"github.com/bytedance/mockey"
)

func TestValidatePathLength(t *testing.T) {
	type args struct {
		source string
	}
	type test struct {
		name               string
		args               args
		longPathsSupported bool
		wantErr            bool
	}

	shortFilename := generateRandomString(60)
	longFilename := generateRandomString(275)

	tests := []test{
		{
			name: "ShortFilenameShouldSucceed",
			args: args{
				source: shortFilename,
			},
			longPathsSupported: true,
			wantErr:            false,
		},
		{
			name: "LongFilenameShouldSucceed",
			args: args{
				source: longFilename,
			},
			longPathsSupported: true,
			wantErr:            false,
		},
		{
			name: "LongFilenameShouldFail",
			args: args{
				source: longFilename,
			},
			longPathsSupported: false,
			wantErr:            true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockey.PatchConvey("Patch supportsLongFilePaths", t, func() {
				// Mock the "supportsLongFilePaths" function to set a fixed response for the testing
				mockey.Mock(supportsLongFilePaths).Return(tt.longPathsSupported).Build()

				if err := ValidatePathLength(tt.args.source); (err != nil) != tt.wantErr {
					t.Errorf("ValidatePathLength() error = %v, wantErr %v", err, tt.wantErr)
				}
			})
		})
	}
}

func generateRandomString(n int) string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

	var sb strings.Builder
	sb.Grow(n)
	for i := 0; i < n; i++ {
		sb.WriteByte(charset[rand.IntN(len(charset))])
	}

	return sb.String()
}

//func Test_supportsLongFilePaths(t *testing.T) {
//    tests := []struct {
//        name string
//        want bool
//    }{
//        {
//            name: "",
//            want: false,
//        },
//    }
//    for _, tt := range tests {
//        t.Run(tt.name, func(t *testing.T) {
//            if got := supportsLongFilePaths(); got != tt.want {
//                t.Errorf("supportsLongFilePaths() = %v, want %v", got, tt.want)
//            }
//        })
//    }
//}
