package transfer_api

import (
    "encoding/hex"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestContainsUnsafeS3Chars(t *testing.T) {
    //ASCII character ranges 00–1F hex (0–31 decimal) and 7F (127 decimal)
    ascii00 := "00"
    asciiCharsInRange00, err := hex.DecodeString(ascii00)
    assert.Nil(t, err)
    ascii1f := "1f"
    asciiCharsInRange1f, err := hex.DecodeString(ascii1f)
    assert.Nil(t, err)

    //Non-printable ASCII characters (128–255 decimal characters)
    nonPrintableLowerEnd := "80"
    asciiCharsInRange80, err := hex.DecodeString(nonPrintableLowerEnd)
    assert.Nil(t, err)
    nonPrintableUpperEnd := "FF"
    asciiCharsInRangeFF, err := hex.DecodeString(nonPrintableUpperEnd)
    assert.Nil(t, err)

    type args struct {
        path string
    }
    tests := []struct {
        name string
        args args
        want bool
    }{
        {
            name: "Contains dash",
            args: args{path: "4my-organization"},
            want: false,
        },
        {
            name: "Contains dots, underscores, slashes",
            args: args{path: "my.great_photos-2014/jan/myvacation.jpg"},
            want: false,
        },
        {
            name: "Contains long path",
            args: args{path: "videos/2014/birthday/video1.wmv"},
            want: false,
        },
        {
            name: "Contains all alphanumerics",
            args: args{path: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890"},
            want: false,
        },
        {
            name: "All special characters",
            args: args{path: "-/!_.*'()"},
            want: false,
        },
        {
            name: "Single space",
            args: args{path: "my file"},
            want: false,
        },
        {
            name: "Contains (&)",
            args: args{path: "this has ampersand &"},
            want: true,
        },
        {
            name: "Contains $",
            args: args{path: "ab$c"},
            want: true,
        },
        {
            name: "Contains @",
            args: args{path: "@bc"},
            want: true,
        },
        {
            name: "Contains =",
            args: args{path: "abc="},
            want: true,
        },
        {
            name: "Contains ;",
            args: args{path: "a;bc"},
            want: true,
        },
        {
            name: "Contains :",
            args: args{path: "a:bc"},
            want: true,
        },
        {
            name: "Contains +",
            args: args{path: "abc+"},
            want: true,
        },
        {
            name: "Contains ,",
            args: args{path: "ab,c"},
            want: true,
        },
        {
            name: "Contains ?",
            args: args{path: "?abc"},
            want: true,
        },
        {
            name: "Contains backslash",
            args: args{path: "ab\\c"},
            want: true,
        },
        {
            name: "Contains {",
            args: args{path: "{abc"},
            want: true,
        },
        {
            name: "Contains }",
            args: args{path: "ab}c"},
            want: true,
        },
        {
            name: "Contains ^",
            args: args{path: "abc^"},
            want: true,
        },
        {
            name: "Contains ?",
            args: args{path: "?abc"},
            want: true,
        },
        {
            name: "Contains %",
            args: args{path: "abc%"},
            want: true,
        },
        {
            name: "Contains `",
            args: args{path: "ab`c"},
            want: true,
        },
        {
            name: "Contains [",
            args: args{path: "[abc"},
            want: true,
        },
        {
            name: "Contains ]",
            args: args{path: "abc]"},
            want: true,
        },
        {
            name: "Contains \"",
            args: args{path: "ab\"c"},
            want: true,
        },
        {
            name: "Contains <",
            args: args{path: "a<bc"},
            want: true,
        },
        {
            name: "Contains >",
            args: args{path: "ab>c"},
            want: true,
        },
        {
            name: "Contains ~",
            args: args{path: "~abc"},
            want: true,
        },
        {
            name: "Contains #",
            args: args{path: "abc#"},
            want: true,
        },
        {
            name: "Contains |",
            args: args{path: "|abc"},
            want: true,
        },
        {
            name: "Contains too many spaces",
            args: args{path: "ab  c"},
            want: true,
        },
        {
            name: "Contains leading slash",
            args: args{path: "/abc"},
            want: true,
        },
        {
            name: "Contains trailing slash",
            args: args{path: "abc/"},
            want: true,
        },
        {
            name: "Contains ascii 00",
            args: args{path: string(asciiCharsInRange00)},
            want: true,
        },
        {
            name: "Contains ascii 1f",
            args: args{path: string(asciiCharsInRange1f)},
            want: true,
        },
        {
            name: "Contains ascii 80",
            args: args{path: string(asciiCharsInRange80)},
            want: true,
        },
        {
            name: "Contains ascii FF",
            args: args{path: string(asciiCharsInRangeFF)},
            want: true,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := ContainsUnsafeS3Chars(tt.args.path); got != tt.want {
                t.Errorf("ContainsUnsafeS3Chars() = %v, want %v", got, tt.want)
            }
        })
    }
}
