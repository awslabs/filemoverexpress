package fs

import (
    "os"
    "path"
    "path/filepath"
    "testing"
)

func getTestDataFolder() (string, error) {
    cwd, err := os.Getwd()
    if err != nil {
        return "", err
    }

    return path.Join(cwd, "..", "..", "testdata"), nil
}

func TestLongestCommonDirectories(t *testing.T) {
    type args struct {
        absolutePaths []string
    }
    tests := []struct {
        name string
        args args
        want string
    }{
        {
            name: "empty slice",
            args: args{absolutePaths: []string{}},
            want: "",
        },
        {
            name: "single entry",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
            }},
            want: "/path/to/",
        },
        {
            name: "two common directories",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
                "/path/to/file2.txt",
            }},
            want: "/path/to/",
        },
        {
            name: "no common directories",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
                "/other/path.txt",
            }},
            want: "/",
        },
        {
            name: "multiple entries",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
                "/path/to/file2.txt",
                "/path/to/my/third/file.txt",
            }},
            want: "/path/to/",
        },
        {
            name: "same exact entry",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
                "/path/to/file.txt",
            }},
            want: "/path/to/",
        },
        {
            name: "single common directory",
            args: args{absolutePaths: []string{
                "/path/to/file.txt",
                "/path/my/file.txt",
            }},
            want: "/path/",
        },
        {
            name: "folders with common directories",
            args: args{absolutePaths: []string{
                "/path/to/dir/",
                "/path/to/dir2/",
            }},
            want: "/path/to/",
        },
        {
            name: "nested entry",
            args: args{absolutePaths: []string{
                "/path/to/",
                "/path/to/file.txt",
            }},
            want: "/path/to/",
        },
        {
            name: "single relative path",
            args: args{absolutePaths: []string{
                "path/file.txt",
            }},
            want: "",
        },
        {
            name: "Mixed relative and absolute",
            args: args{absolutePaths: []string{
                "/path/to/",
                "/path/to/file.txt",
                "path/to/anotherfile.txt",
            }},
            want: "",
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := LongestCommonDirectories(tt.args.absolutePaths); got != tt.want {
                t.Errorf("LongestCommonDirectories() = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestPathIsDir(t *testing.T) {
    type args struct {
        input string
    }

    td, err := getTestDataFolder()
    if err != nil {
        t.Errorf("Failed getting test data directory: %s", err)
        return
    }

    tests := []struct {
        name    string
        args    args
        want    bool
        wantErr bool
    }{
        {
            name: "TestValidDir",
            args: args{
                input: td,
            },
            want:    true,
            wantErr: false,
        },
        {
            name: "TestValidFile",
            args: args{
                input: path.Join(td, "utils_sources_data", "file1"),
            },
            want:    false,
            wantErr: false,
        },
        {
            name: "TestInvalidDir",
            args: args{
                input: filepath.Join(td, "invalid"),
            },
            want:    false,
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := PathIsDir(tt.args.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("PathIsDir() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("PathIsDir() got = %v, want %v", got, tt.want)
            }
        })
    }
}

func TestPathIsFile(t *testing.T) {
    type args struct {
        input string
    }

    td, err := getTestDataFolder()
    if err != nil {
        t.Errorf("Failed getting test data directory: %s", err)
        return
    }

    tests := []struct {
        name    string
        args    args
        want    bool
        wantErr bool
    }{
        {
            name: "TestValidFile",
            args: args{
                input: path.Join(td, "utils_sources_data", "file1"),
            },
            want:    true,
            wantErr: false,
        },
        {
            name: "TestValidDir",
            args: args{
                input: td,
            },
            want:    false,
            wantErr: false,
        },
        {
            name: "TestInvalidFile",
            args: args{
                input: path.Join(td, "utils_sources_data", "invalid-file"),
            },
            want:    false,
            wantErr: true,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := PathIsFile(tt.args.input)
            if (err != nil) != tt.wantErr {
                t.Errorf("PathIsFile() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("PathIsFile() got = %v, want %v", got, tt.want)
            }
        })
    }
}
