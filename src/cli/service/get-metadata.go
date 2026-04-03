package service

import (
    "os"
    "slices"
    "strings"

    "github.com/aws/aws-sdk-go-v2/config"
    "gopkg.in/ini.v1"

    "github.com/awslabs/filemoverexpress/logger"
)

func loadAWSProfiles() []string {
    configFiles := []string{
        config.DefaultSharedConfigFilename(),
        config.DefaultSharedCredentialsFilename(),
    }
    awsProfiles := make([]string, 0)

    for _, iniPath := range configFiles {
        file, err := ini.Load(iniPath)
        if err != nil {
            if !os.IsNotExist(err) {
                logger.Trace("Couldn't read profiles from %s: %s", iniPath, err)
            }
            continue
        }

        for _, profileName := range file.SectionStrings() {
            profileName = strings.TrimPrefix(profileName, "profile ")

            if !slices.Contains[[]string, string](awsProfiles, profileName) {
                awsProfiles = append(awsProfiles, profileName)
            }
        }
    }

    slices.Sort[[]string](awsProfiles)
    return awsProfiles
}
