package inventory

import (
    "errors"
    "strings"
    "time"

    "github.com/awslabs/filemoverexpress/constants"
    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/checksumtypes"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    "github.com/awslabs/filemoverexpress/types/inventorytypes"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/safeconv"
)

func GenerateInventory(input inventorytypes.GenerateInventoryInput) error {
    reportId, err := utils.Sha256Hash(time.Now().String())
    if err != nil {
        return err
    }

    events.Events.Send(&eventtypes.InventoryReportStartedEvent{
        ReportId:            reportId,
        TransferProfileName: input.TransferProfile.Name,
        Bucket:              input.TransferProfile.Bucket,
        Prefix:              "",
        StartTime:           time.Now(),
    })

    s3m, err := transferapi.NewS3Manager(transferapi.S3ManagerConfig{
        AwsProfile: input.TransferProfile.Profile,
        Bucket:     input.TransferProfile.Bucket,
        Region:     input.TransferProfile.Region,
        Endpoint:   input.TransferProfile.Endpoint,
    })
    if err != nil {
        events.Events.Send(&eventtypes.InventoryReportErrorEvent{
            ReportId:            reportId,
            TransferProfileName: input.TransferProfile.Name,
            Bucket:              input.TransferProfile.Bucket,
            Prefix:              "",
            Error:               err.Error(),
        })
        return err
    }

    var output transferapi.ListObjectsOutput

    if input.IncludeChecksums {
        output, err = s3m.ListObjectsWithMetadata("")
    } else {
        output, err = s3m.ListObjects("")
    }
    if err != nil {
        events.Events.Send(&eventtypes.InventoryReportErrorEvent{
            ReportId:            reportId,
            TransferProfileName: input.TransferProfile.Name,
            Bucket:              input.TransferProfile.Bucket,
            Prefix:              "",
            Error:               err.Error(),
        })
        return err
    }

    var inventoryReportObjects []inventorytypes.S3Object
    for _, object := range output.S3Objects {
        // Validate before conversion - S3 shouldn't return negative sizes
        size, err := safeconv.Int64ToUint64(object.Size)
        if err != nil {
            // Log warning and skip object with invalid size
            logger.Error("Warning: Invalid object size %d for %s: %v", object.Size, object.Key, err)
            continue
        }

        inventoryReportObject := inventorytypes.S3Object{
            Key:          object.Key,
            Size:         size,
            LastModified: object.LastModified,
            Checksums:    nil,
        }
        if input.IncludeChecksums {
            inventoryReportObject.Checksums = buildChecksumMap(object.Metadata)
        }
        inventoryReportObjects = append(inventoryReportObjects, inventoryReportObject)
    }

    outputFile, err := outputInventoryFile(input, &inventoryReportObjects, reportId)
    if err != nil {
        return err
    }

    // leaving this sleep here as I noticed some weirdness with out-of-order or missing events if run on a small bucket
    time.Sleep(constants.SleepDuration)

    events.Events.Send(&eventtypes.InventoryReportCompletedEvent{
        ReportId:            reportId,
        TransferProfileName: input.TransferProfile.Name,
        Bucket:              input.TransferProfile.Bucket,
        Prefix:              "",
        OutputFile:          outputFile,
        CompleteTime:        time.Now(),
    })

    return nil
}

func outputInventoryFile(input inventorytypes.GenerateInventoryInput,
    objects *[]inventorytypes.S3Object, reportId string) (outputFile string, err error) {
    commands := map[string]func(input outputFileSettings) (string, error){
        strYaml: func(input outputFileSettings) (string, error) {
            return outputYaml(input)
        },
        strJson: func(input outputFileSettings) (string, error) {
            return outputJson(input)
        },
        strXml: func(input outputFileSettings) (string, error) {
            return outputXml(input)
        },
        strCsv: func(input outputFileSettings) (string, error) {
            return outputCsv(input)
        },
    }

    formatFunc, ok := commands[strings.ToLower(input.OutputFormat)]
    if !ok {
        return "", errors.New(strInvalidFormat)
    }
    outputFile, err = formatFunc(outputFileSettings{
        s3Objects:        objects,
        pretty:           input.Pretty,
        includeChecksums: input.IncludeChecksums,
    })
    if err != nil {
        events.Events.Send(&eventtypes.InventoryReportErrorEvent{
            ReportId:            reportId,
            TransferProfileName: input.TransferProfile.Name,
            Bucket:              input.TransferProfile.Bucket,
            Prefix:              "",
            Error:               err.Error(),
        })
        return "", err
    }
    return outputFile, err
}

func buildChecksumMap(metadata map[string]string) (checksumMap *checksumtypes.Checksum) {
    checksumMap = &checksumtypes.Checksum{}
    if metadata == nil {
        return checksumMap
    }
    if checksum, ok := metadata[string(constants.AlgorithmMD5)]; ok {
        checksumMap.MD5Hex = checksum
    }
    if checksum, ok := metadata[string(constants.AlgorithmXXHash)]; ok {
        checksumMap.XXHash = checksum
    }
    if checksum, ok := metadata[string(constants.AlgorithmXXHash64)]; ok {
        checksumMap.XXHash64 = checksum
    }
    if checksum, ok := metadata[string(constants.AlgorithmXXH3)]; ok {
        checksumMap.XXH3 = checksum
    }
    return checksumMap
}
