package supportfile

import (
	"archive/zip"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"time"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/supportfiletypes"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func ZipWriter(files []supportfiletypes.SupportFile) (filename string, outputDir string, err error) {
	zipFile, err := createZipFile()
	if err != nil {
		return "", "", err
	}

	err = writeFiles(files, zipFile.fh)
	if err != nil {
		return "", "", err
	}

	filename = zipFile.outputFile
	outputDir = zipFile.outputDir
	fmt.Printf(strZipFileWritten, path.Join(outputDir, filename))

	return filename, outputDir, nil
}

func createZipFile() (output createZipFileOutput, err error) {
	outputFile, outputDir, err := generateFileName()
	if err != nil {
		return output, err
	}

	filename := filepath.Join(outputDir, outputFile)
	fh, err := os.Create(filename)
	if err != nil {
		return output, fmt.Errorf(strFailedGeneratingOutputFile, err.Error(), err)
	}

	output.outputFile = outputFile
	output.outputDir = outputDir
	output.fh = fh

	return output, err
}

func writeFile(w *zip.Writer, file supportfiletypes.SupportFile) error {
	byteContent := []byte(file.Body)
	header, err := zip.FileInfoHeader(&fileInfo{
		name:    file.Name,
		size:    int64(len(byteContent)),
		mode:    0644,
		modTime: time.Now(),
		isDir:   false,
	})
	if err != nil {
		return err
	}
	header.Method = zip.Deflate
	headerWriter, err := w.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = headerWriter.Write(byteContent)
	if err != nil {
		return err
	}
	return nil
}

func writeFiles(files []supportfiletypes.SupportFile, fh *os.File) error {
	w := zip.NewWriter(fh)

	defer func() {
		if err := w.Close(); err != nil {
			events.Events.Warn("Failed closing zip writer: %s", err.Error())
		}
	}()

	// Add some files to the archive.
	for _, file := range files {
		err := writeFile(w, file)
		if err != nil {
			return err
		}
	}

	return nil
}

func generateFileName() (string, string, error) {
	outputDir := filepath.Join(config.GetConfigDir(), "support-files")

	pathExists, err := fs.PathExists(outputDir)
	if err != nil {
		return "", "", err
	}

	if !pathExists {
		if err = os.MkdirAll(outputDir, 0755); err != nil {
			return "", "", err
		}
	}

	isDir, err := fs.PathIsDir(outputDir)
	if err != nil {
		return "", "", err
	}

	if !isDir {
		return "", "", fmt.Errorf(strOutputDirIsFile, outputDir)
	}

	filename := fmt.Sprintf("supportfile-%s.zip", time.Now().Format("20060102-150405"))
	return filename, outputDir, err
}
