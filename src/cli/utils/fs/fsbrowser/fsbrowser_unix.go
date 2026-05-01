//go:build unix

package fsbrowser

import (
	"os"
	"path/filepath"

	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/logger"
	pbtypes "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func ListDirectory(path string) (*pbtypes.FsFolder, error) {
	output := pbtypes.FsFolder{
		Path: path,
	}
	content, err := os.ReadDir(path)
	if err != nil {
		logger.Warn("Error when reading path '%s'. error: %s\n", path, err.Error())
		return &output, err
	}

	for _, file := range content {
		fileInfo, _ := file.Info()
		pathName := filepath.Join(path, file.Name())
		if fileInfo.Mode()&excludedModes != 0 {
			continue
		}
		if ShouldExcludeDirEntry(pathName, config.LoadConfiguration().APIServer.BlockedPathList) {
			continue
		}

		if fileInfo.IsDir() {
			output.Folders = append(output.Folders, pathName)
		} else {
			output.Files = append(output.Files, &pbtypes.FsFile{
				Path:         pathName,
				Size:         fileInfo.Size(),
				LastModified: timestamppb.New(fileInfo.ModTime()),
			})
		}
	}
	return &output, err
}

func isRootPath(path string) bool {
	return path == "/"
}
