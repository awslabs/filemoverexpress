package discovery

import (
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

    tests := []test{
        {
            name: "ShortFilenameShouldSucceed",
            args: args{
                source: "testdata/discovery/text-files/test.txt",
            },
            longPathsSupported: true,
            wantErr:            false,
        },
        {
            name: "LongFilenameShouldSucceed",
            args: args{
                source: StrTestLongFileName,
            },
            longPathsSupported: true,
            wantErr:            false,
        },
        {
            name: "LongFilenameShouldFail",
            args: args{
                source: StrTestLongFileName,
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

func Test_supportsLongFilePaths(t *testing.T) {
    tests := []struct {
        name string
        want bool
    }{
        {
            name: "",
            want: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := supportsLongFilePaths(); got != tt.want {
                t.Errorf("supportsLongFilePaths() = %v, want %v", got, tt.want)
            }
        })
    }
}
