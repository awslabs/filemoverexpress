package supportfile

import (
    "gopkg.in/yaml.v2"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/supportfiletypes"
)

func Create() (outputFile string, outputDir string, err error) {
    inst := globals.GetInstance()
    mi := supportfiletypes.MachineInfo{
        Version:   inst.GetVersion(),
        MachineId: inst.GetMachineId(),
    }
    mounts := GetMountPoints()
    logs := GetLogs()
    var files []supportfiletypes.SupportFile
    supportFileMap := make(map[string]interface{})

    supportFileMap["machineinfo.yaml"] = mi
    supportFileMap["memory.yaml"] = GetMemoryInformation()
    supportFileMap["mounts.yaml"] = mounts
    supportFileMap["mount_usages.yaml"] = GetMountPointUsage(mounts)
    supportFileMap[constants.ConfigFullName] = inst.GetCfg()
    supportFileMap["limits.yaml"] = GetLimits()

    for filename, input := range supportFileMap {
        marshalInput, err := marshalStructs(input)
        if err != nil {
            return "", "", err
        }
        files = append(files, supportfiletypes.SupportFile{Name: filename, Body: marshalInput})
    }

    files = append(files, logs...)

    outputFile, outputDir, err = ZipWriter(files)
    if err != nil {
        return "", "", err
    }

    return outputFile, outputDir, nil
}

func marshalStructs(input interface{}) (string, error) {
    out, err := yaml.Marshal(input)
    if err != nil {
        logger.Warn(strFailedCreatingSupportFile, err)
        return "", err
    }

    return string(out), nil
}
