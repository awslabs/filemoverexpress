package core

import (
	"errors"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCreateOutputFileAndDestDir(t *testing.T) {
	type args struct {
		filePath string
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Create Output File and Dir",
			args: args{
				filePath: "/tmp/TestCreateOutputFileAndDestDir/test1/test.txt",
			},
			wantErr: false,
		},
		{
			name: "Create dir that already exists",
			args: args{
				filePath: "/tmp/TestCreateOutputFileAndDestDir/AlreadyExists/file.txt",
			},
			wantErr: false,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/TestCreateOutputFileAndDestDir/AlreadyExists", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestCreateOutputFileAndDestDir: Error creating temp dir: %v", mkdirErr)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := CreateOutputFileAndDestDir(tt.args.filePath)
			if (err != nil) != tt.wantErr {
				t.Errorf("CreateOutputFileAndDestDir() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/TestCreateOutputFileAndDestDir"); removeErr != nil {
		t.Logf("TestCreateOutputFileAndDestDir: Error removing temp dir: %v", removeErr)
	}
}

func TestDirExists(t *testing.T) {
	type args struct {
		dirPath string
	}
	tests := []struct {
		name    string
		args    args
		want    bool
		wantErr bool
	}{
		{
			name: "Dir does not exist",
			args: args{
				dirPath: "/tmp/transferAPITestDirExists/DoesNotExist",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "Dir exists",
			args: args{
				dirPath: "/tmp/transferAPITestDirExists/Exists",
			},
			want:    true,
			wantErr: false,
		},
	}
	if mkdirErr := os.MkdirAll("/tmp/transferAPITestDirExists/Exists", os.ModePerm); mkdirErr != nil {
		t.Errorf("TestDirExists: Error creating temp dir: %v", mkdirErr)
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DirExists(tt.args.dirPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("DirExists() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("DirExists() got = %v, want %v", got, tt.want)
			}
		})
	}
	if removeErr := os.RemoveAll("/tmp/transferAPITestDirExists"); removeErr != nil {
		t.Logf("TestDirExists: Error removing temp dirs: %v", removeErr)
	}
}

func TestCause(t *testing.T) {
	err := errors.New("fail")
	cause := Cause(err)
	assert.Equal(t, err, cause)
}
