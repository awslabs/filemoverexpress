package supportfile

import (
    "fmt"
    "os"
    "path/filepath"

    "github.com/awslabs/filemoverexpress/config"
    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/supportfiletypes"
)

func GetLogs() []supportfiletypes.SupportFile {
    var (
        output = make([]supportfiletypes.SupportFile, 0)
        logDir = config.GetLogDir()
    )

    logFilePath := filepath.Join(logDir, constants.DefaultLogFilename)
    crashFilePath := filepath.Join(logDir, "crash.log")

    if data, err := readFile(logFilePath); err == nil {
        output = append(output, supportfiletypes.SupportFile{
            Name: filepath.Join("logs", constants.DefaultLogFilename),
            Body: data,
        })
    } else {
        logger.Debug("Failed reading %s: %s", logFilePath, err)
    }

    if data, err := readFile(crashFilePath); err == nil {
        output = append(output, supportfiletypes.SupportFile{
            Name: filepath.Join("logs", "crash.log"),
            Body: data,
        })
    } else {
        logger.Debug("Failed reading %s: %s", crashFilePath, err)
    }

    return output
}

func readFile(pathName string) (string, error) {
    data, err := os.ReadFile(pathName)
    if err != nil {
        return "", fmt.Errorf("failed reading data from file: %s", err)
    }

    return string(data), nil
}
