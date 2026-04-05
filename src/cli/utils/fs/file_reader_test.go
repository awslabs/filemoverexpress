package fs

import (
    "fmt"
    "os"
    "path/filepath"
    "testing"
    "time"
)

func TestFileReader_Read(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    reader := FileReader{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = reader.Read(buffer)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileReader_Read failed, expected 1896053708 bytes but read %d", len(buffer))
    }
}

func TestFileReader_ReadAt(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    reader := FileReader{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = reader.ReadAt(buffer, 0)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileReader_ReadAt failed, expected 1896053708 bytes but read %d", len(buffer))
    }
}

func TestFileReader_Seek(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    reader := FileReader{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = reader.ReadAt(buffer, 0)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileReader_Seek failed, expected 1896053708 bytes but read %d", len(buffer))
    }

    _, err = reader.Seek(0, 0)
    if err != nil {
        t.Errorf("TestFileReader_Seek failed to seek to start of file")
    }
}

func TestFileReader_Speed(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    reader := FileReader{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = reader.ReadAt(buffer, 0)
    if err != nil {
        t.Errorf("TestFileReader_Speed failed during ReadAt")
    }
    // Second read required since aws SDK reads the file from disk twice
    _, err = reader.ReadAt(buffer, 0)
    if err != nil {
        t.Errorf("TestFileReader_Speed failed during second ReadAt")
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileReader_Speed failed, expected 1896053708 bytes but read %d", len(buffer))
    }
    speed := reader.Speed()
    if speed <= 0.0 {
        t.Errorf("TestFileReader_Speed failed to output speed.")
    }
}

func getTestFileAndInfo() (os.FileInfo, *os.File, error) {
    cwd, err := os.Getwd()
    if err != nil {
        return nil, nil, fmt.Errorf("failed getting working directory: %s", err)
    }

    td := filepath.Join(cwd, "..", "..", "testdata")
    testFile := filepath.Join(td, "utils_sources_data", "file1")
    info, err := os.Stat(testFile)
    if err != nil {
        return nil, nil, fmt.Errorf("TestFileReader_Read failed to stat input file: %s\n", err)
    }

    f, err := os.Open(testFile)
    if err != nil {
        return nil, nil, fmt.Errorf("TestFileReader_Read failed to open input file: %s\n", err)
    }

    return info, f, nil
}
