package fsbrowser

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/utils"
	fmefs "github.com/awslabs/filemoverexpress/utils/fs"
)

const (
	excludedModes          = fs.ModeDevice | fs.ModeCharDevice | fs.ModeSymlink | fs.ModeNamedPipe | fs.ModeSocket
	File          PathType = "file"
	Folder        PathType = "folder"
)

type (
	PathType string
)

// ShouldExcludeDirEntry takes a path and a list of entries to be excluded,
// and returns true if any of the entries are part of the path. Entries that are absolute paths are treated as case-insensitive,
// and explicit folders are case-sensitive.
//
//revive:disable:cognitive-complexity
//nolint:nestif
func ShouldExcludeDirEntry(pathName string, blockedPaths []string) bool {
	if !fmefs.FileExists(pathName) {
		for _, entry := range blockedPaths {
			if filepath.IsAbs(entry) {
				if strings.HasPrefix(pathName, entry) {
					return true
				}
			} else {
				parts := strings.Split(pathName, string(filepath.Separator))
				if utils.StringArrayContains(parts, entry) {
					return true
				}
			}
		}
		return false
	}
	symName, err := filepath.EvalSymlinks(pathName)
	symName = symName + string(filepath.Separator)
	if err != nil {
		events.Events.Error("Error evaluating path %s: %s", pathName, err)
		return true
	}

	for _, entry := range blockedPaths {
		if filepath.IsAbs(entry) {
			entry, err = filepath.EvalSymlinks(entry)
			if err != nil {
				events.Events.Error("Error evaluating blocked entry %s: %s", entry, err)
				return true
			}
			if strings.HasPrefix(strings.ToLower(symName), strings.ToLower(entry)) {
				return true
			}
		} else {
			parts := strings.Split(pathName, string(filepath.Separator))
			if utils.StringArrayContains(parts, entry) {
				return true
			}
			symParts := strings.Split(symName, string(filepath.Separator))
			if utils.StringArrayContains(symParts, entry) {
				return true
			}
		}
	}
	return false
}

func DeleteLocalPath(pathToDelete string, pathType PathType) error {
	cleanedPathToDelete := filepath.Clean(pathToDelete)

	// check empty path
	if cleanedPathToDelete == "" {
		return fmt.Errorf("cannot delete empty path")
	}

	// check root
	if isRootPath(cleanedPathToDelete) {
		return fmt.Errorf("cannot delete root path")
	}

	// check path existence
	pathExists, err := fmefs.PathExists(cleanedPathToDelete)
	if err != nil {
		return fmt.Errorf("cannot delete %s %s because could not verify that it exists: %s", pathType, cleanedPathToDelete,
			err)
	}
	if !pathExists {
		return fmt.Errorf("cannot delete %s %s because it does not exist", pathType, cleanedPathToDelete)
	}

	// check blocked path
	cfg := config.LoadConfiguration()
	if ShouldExcludeDirEntry(cleanedPathToDelete, cfg.APIServer.BlockedPathList) {
		return fmt.Errorf("%s %s contains a blocked path", pathType, cleanedPathToDelete)
	}

	// perform deletion
	if pathType == Folder {
		err = os.RemoveAll(cleanedPathToDelete)
	} else {
		err = os.Remove(cleanedPathToDelete)
	}
	if err != nil {
		return fmt.Errorf("an error occurred when deleting %s %s: %s", pathType, cleanedPathToDelete, err)
	}

	return nil
}

func RenameLocalPath(pathToRename string, newPathName string, pathType PathType) error {
	cleanedPathToRename := filepath.Clean(pathToRename)
	cleanedNewPathName := filepath.Clean(newPathName)

	// check empty paths
	if cleanedPathToRename == "" || cleanedNewPathName == "" {
		return fmt.Errorf("cannot rename to or from an empty path")
	}

	// check root
	if isRootPath(cleanedPathToRename) {
		return fmt.Errorf("cannot rename root path")
	}

	// check old path existence
	pathExists, err := fmefs.PathExists(cleanedPathToRename)
	if err != nil {
		return fmt.Errorf("cannot rename %s %s because could not verify that it exists: %s", pathType, cleanedPathToRename, err)
	}
	if !pathExists {
		return fmt.Errorf("cannot rename %s %s because it does not exist", pathType, cleanedPathToRename)
	}

	// check new path existence
	pathExists, err = fmefs.PathExists(newPathName)
	if err != nil {
		return fmt.Errorf("cannot rename %s to new name %s because could not verify that it already exists: %s", pathType,
			cleanedNewPathName, err)
	}
	if pathExists {
		return fmt.Errorf("cannot rename %s to %s because it already exists", pathType, cleanedNewPathName)
	}

	// check blocked path
	cfg := config.LoadConfiguration()
	pathsToCheck := []string{cleanedPathToRename, cleanedNewPathName}
	for _, path := range pathsToCheck {
		if ShouldExcludeDirEntry(path, cfg.APIServer.BlockedPathList) {
			return fmt.Errorf("%s %s contains a blocked path", pathType, path)
		}
	}

	// perform rename
	err = os.Rename(cleanedPathToRename, cleanedNewPathName)
	if err != nil {
		return fmt.Errorf("an error occurred when renaming %s %s to %s: %s", pathType, cleanedPathToRename, cleanedNewPathName, err.Error())
	}

	return nil
}
