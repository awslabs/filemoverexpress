package core

import (
    "os"
    "path/filepath"
    "regexp"

    "github.com/awslabs/filemoverexpress/events"
    fmeErrors "github.com/awslabs/filemoverexpress/fme-errors"
)

type causer interface {
    Cause() error
}

func Cause(err error) error {
    if err != nil {
        cause, ok := err.(causer)
        if !ok {
            return err
        }

        err = cause.Cause()
    }

    return err
}

func CreateDirIfDoesNotExists(dir string) error {
    dirExists, err := DirExists(dir)
    if err != nil {
        if err.Error() == "is-file" {
            events.Events.Error(strDestinationIsAFile)
            return err
        }
        events.Events.Error(strErrorCheckingDestinationDir, err)
        return err
    }

    if !dirExists {
        err = os.MkdirAll(dir, 0755)
        if err != nil {
            events.Events.Error(strFailedCreatingTargetDir, err)
            return err
        }
    }
    return nil
}

func CreateOutputFileAndDestDir(filePath string) (*os.File, error) {
    outputDir, _ := filepath.Split(filePath)
    if outputDir != "" {
        dirExists, err := DirExists(outputDir)
        if err != nil {
            return nil, err
        }

        if !dirExists {
            if err := os.MkdirAll(outputDir, 0755); err != nil {
                return nil, err
            }
        }
    }

    outputFile, err := os.Create(filePath)
    if err != nil {
        return nil, err
    }
    return outputFile, nil
}

func DirExists(dirPath string) (bool, error) {
    info, err := os.Stat(dirPath)
    if err != nil {
        if os.IsNotExist(err) {
            return false, nil
        }
        return false, err
    }
    if !info.IsDir() {
        return false, fmeErrors.ErrIsFile
    }
    return true, nil
}

func ContainsUnsupportedChars(path string) bool {
    //test groups of spaces
    r, _ := regexp.Compile(" {2,}")
    if r.MatchString(path) {
        return true
    }

    //test whether it only contains characters in approved chars regex
    isValid := regexp.MustCompile(`^[a-zA-Z0-9!_.*'() -]+(/[a-zA-Z0-9!_.*'() -]+)*$`).MatchString
    return !isValid(path)
}
