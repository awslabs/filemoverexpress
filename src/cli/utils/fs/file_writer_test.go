package fs

import (
    "fmt"
    "testing"
    "time"
)

func TestFileWriter_Write(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    writer := FileWriter{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = writer.Write(buffer)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileWriter_Write failed, expected 1896053708 bytes but wrote %d", len(buffer))
    }
}

func TestFileWriter_WriteAt(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    writer := FileWriter{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = writer.WriteAt(buffer, 0)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileWriter_WriteAt failed, expected 1896053708 bytes but wrote %d", len(buffer))
    }
}

func TestFileWriter_Seek(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    writer := FileWriter{
        File:  f,
        Size:  info.Size(),
        Start: time.Now(),
    }

    buffer := make([]byte, info.Size())
    _, err = writer.WriteAt(buffer, 0)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileWriter_Seek failed, expected 1896053708 bytes but wrote %d", len(buffer))
    }

    _, err = writer.Seek(0, 0)
    if err != nil {
        t.Errorf("TestFileWriter_Seek failed to seek to start of file")
    }
}

func TestFileWriter_Speed(t *testing.T) {
    info, f, err := getTestFileAndInfo()
    if err != nil {
        t.Error(err.Error())
        return
    }

    writer := FileWriter{
        File:    f,
        Size:    info.Size(),
        Start:   time.Now(),
        written: 12312123,
    }

    buffer := make([]byte, info.Size())
    _, err = writer.WriteAt(buffer, 0)
    if err != nil {
        fmt.Println()
    }

    if len(buffer) != 2097152 {
        t.Errorf("TestFileWriter_Speed failed, expected 1896053708 bytes but wrote %d", len(buffer))
    }
    speed := writer.Speed()
    if speed <= 0.0 {
        t.Errorf("TestFileWriter_Speed failed to output speed.")
    }
}

//func getTestWriterFileAndInfo() (os.FileInfo, *os.File, error) {
//	cwd, err := os.Getwd()
//	if err != nil {
//		return nil, nil, errors.New(fmt.Sprintf("Failed getting working directory: %s", err))
//	}
//
//	td := path.Join(cwd, "..", "testdata")
//	if err := os.Chdir(td); err != nil {
//		return nil, nil, err
//	}
//
//	testFile := path.Join(td, "utils_sources_data/file1")
//	info, err := os.Stat(testFile)
//	if err != nil {
//		return nil, nil, errors.New(fmt.Sprintf("TestFileWriter_Write failed to stat input file: %s\n", err))
//	}
//
//	f, err := os.Open(testFile)
//	if err != nil {
//		return nil, nil, errors.New(fmt.Sprintf("TestFileWriter_Write failed to open input file: %s\n", err))
//	}
//
//	return info, f, nil
//}
