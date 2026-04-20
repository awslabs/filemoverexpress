//go:build windows

package fsbrowser

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/shirou/gopsutil/v4/disk"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func ListDirectory(path string) (*fmev1.FsFolder, error) {
	if path == "/" || path == "" {
		return listDrives()
	}
	winPath, err := fs.ConvertPathToWindows(path)
	if err != nil {
		return &fmev1.FsFolder{}, err
	}

	return listFolders(winPath)
}

func listDrives() (*fmev1.FsFolder, error) {
	drives, err := disk.Partitions(true)
	if err != nil {
		return &fmev1.FsFolder{}, err
	}
	output := fmev1.FsFolder{Path: "/"}
	for _, drive := range drives {
		output.Folders = append(
			output.Folders,
			strings.ToLower(
				strings.TrimSuffix(drive.Mountpoint, ":"),
			),
		)
	}

	return &output, nil
}

func listFolders(winPath string) (*fmev1.FsFolder, error) {
	output := fmev1.FsFolder{
		Path: fs.ConvertPathToGRPC(winPath),
	}

	content, err := os.ReadDir(winPath)
	if err != nil {
		return &output, err
	}

	for _, file := range content {
		fileInfo, _ := file.Info()
		pathName := filepath.Join(winPath, file.Name())
		if fileInfo.Mode()&excludedModes != 0 {
			continue
		}
		if ShouldExcludeDirEntry(pathName, globals.GetInstance().GetCfg().APIServer.BlockedPathList) {
			continue
		}

		if fileInfo.IsDir() {
			output.Folders = append(output.Folders, fs.ConvertPathToGRPC(pathName))
		} else {
			output.Files = append(output.Files, &fmev1.FsFile{
				Path:         fs.ConvertPathToGRPC(pathName),
				Size:         fileInfo.Size(),
				LastModified: timestamppb.New(fileInfo.ModTime()),
			})
		}
	}

	return &output, err
}

func isRootPath(path string) bool {
	return regexp.MustCompile(`^[a-zA-Z]:\\?$`).MatchString(path)
}
