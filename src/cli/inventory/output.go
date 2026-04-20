package inventory

import (
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"gopkg.in/yaml.v2"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/types/inventorytypes"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

func outputCsv(input outputFileSettings) (outputFile string, err error) {
	outputFile, err = generateFileName("csv")
	if err != nil {
		events.Events.Error(strFailedCreatingFilename, err)
		return "", err
	}
	if input.includeChecksums {
		outputFile, err = outputCsvWithChecksums(input, outputFile)
		if err != nil {
			return outputFile, err
		}
	} else {
		outputFile, err = outputCsvWithoutChecksums(input, outputFile)
		if err != nil {
			return outputFile, err
		}
	}

	return outputFile, nil
}

func outputCsvWithoutChecksums(input outputFileSettings, outputFile string) (string, error) {
	objects := [][]string{
		{
			"object_key",
			"object_size",
			"last_modified",
		},
	}

	file, err := os.Create(outputFile)
	if err != nil {
		return "", err
	}

	defer fs.CloseFile(fs.CloseFileInput{File: file, Exit: true})

	fileWriter := csv.NewWriter(file)

	for _, obj := range *input.s3Objects {
		metadata := []string{
			obj.Key,
			strconv.FormatUint(obj.Size, constants.BaseDecimal),
			obj.LastModified.String(),
		}
		objects = append(objects, metadata)
	}

	for _, obj := range objects {
		err = fileWriter.Write(obj)
		if err != nil {
			return "", err
		}
	}

	fileWriter.Flush()
	return outputFile, nil
}

func outputCsvWithChecksums(input outputFileSettings, outputFile string) (string, error) {
	objects := [][]string{
		{
			"object_key",
			"object_size",
			"last_modified",
			"md5-hex",
			"xxhash",
			"xxhash64",
			"xxh3",
		},
	}

	file, err := os.Create(outputFile)
	if err != nil {
		return "", err
	}

	defer fs.CloseFile(fs.CloseFileInput{File: file, Exit: true})

	fileWriter := csv.NewWriter(file)
	for _, obj := range *input.s3Objects {
		metadata := []string{
			obj.Key,
			strconv.FormatUint(obj.Size, constants.BaseDecimal),
			obj.LastModified.String(),
			obj.Checksums.MD5Hex,
			obj.Checksums.XXHash,
			obj.Checksums.XXHash64,
			obj.Checksums.XXH3,
		}
		objects = append(objects, metadata)
	}

	for _, obj := range objects {
		err = fileWriter.Write(obj)
		if err != nil {
			return "", err
		}
	}

	fileWriter.Flush()
	return outputFile, nil
}

func outputXml(input outputFileSettings) (string, error) {
	outputFile, err := generateFileName("xml")
	if err != nil {
		events.Events.Error(strFailedCreatingFilename, err)
		return "", err
	}

	var xmlOutput []byte
	inventoryInput := inventorytypes.InventoryXMLInput{
		S3Objects: input.s3Objects,
	}

	if input.pretty {
		xmlOutput, err = xml.MarshalIndent(&inventoryInput, "", "    ")
	} else {
		xmlOutput, err = xml.Marshal(&inventoryInput)
	}
	if err != nil {
		return "", err
	}

	err = os.WriteFile(outputFile, xmlOutput, 0644) // #nosec G306
	if err != nil {
		return "", err
	}

	return outputFile, nil
}

func outputJson(input outputFileSettings) (string, error) {
	outputFile, err := generateFileName("json")
	if err != nil {
		events.Events.Error(strFailedCreatingFilename, err)
		return "", err
	}

	var jsonOutput []byte
	if input.pretty {
		jsonOutput, err = json.MarshalIndent(&input.s3Objects, "", "    ")
	} else {
		jsonOutput, err = json.Marshal(&input.s3Objects)
	}
	if err != nil {
		return "", err
	}

	err = os.WriteFile(outputFile, jsonOutput, 0644) // #nosec G306
	if err != nil {
		return "", err
	}

	return outputFile, nil
}

func outputYaml(input outputFileSettings) (string, error) {
	outputFile, err := generateFileName("yaml")
	if err != nil {
		events.Events.Error(strFailedCreatingFilename, err)
		return "", err
	}
	yamlOutput, err := yaml.Marshal(&input.s3Objects)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(outputFile, yamlOutput, 0644) // #nosec G306
	if err != nil {
		return "", err
	}
	return outputFile, nil
}

func generateFileName(extension string) (string, error) {
	var outputDir string
	cfg := globals.GetInstance().GetCfg()

	cfgDir := cfg.Reports.Directory
	if filepath.IsAbs(cfgDir) {
		outputDir = cfgDir
	} else {
		outputDir = filepath.Join(config.GetConfigDir(), cfgDir)
	}

	pathExists, err := fs.PathExists(outputDir)
	if err != nil {
		return outputDir, err
	}

	if !pathExists {
		if err = os.MkdirAll(outputDir, 0755); err != nil {
			return "", err
		}
	}

	isDir, err := fs.PathIsDir(outputDir)
	if err != nil {
		return "", err
	}

	if !isDir {
		return "", fmt.Errorf(strOutputDirIsFile, outputDir)
	}

	fileName := fmt.Sprintf("bucket-report-%s.%s", time.Now().Format("20060102-150405"), extension)
	return filepath.Join(outputDir, fileName), err
}
