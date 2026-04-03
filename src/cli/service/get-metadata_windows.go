//go:build windows

package service

import (
    "fmt"
    "os"
    "runtime"

    "connectrpc.com/connect"

    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/types/eventtypes"
    "github.com/awslabs/filemoverexpress/utils/fs"
    "github.com/awslabs/filemoverexpress/utils/systeminfo"
)

func getMetadataInfo(peer connect.Peer) eventtypes.MetadataEvent {
    global := globals.GetInstance()
    cfg := global.GetCfg()

    var permissionsData map[string]bool
    if isLocalClient(peer) {
        permissionsData = map[string]bool{
            eventtypes.PermissionsAllowUIConfigKey:           true,
            eventtypes.PermissionsAllowLocalRenameDeleteKey:  true,
            eventtypes.PermissionsAllowRemoteRenameDeleteKey: true,
        }
    } else {
        permissionsData = map[string]bool{
            eventtypes.PermissionsAllowUIConfigKey:           cfg.APIServer.Permissions.AllowUIConfiguration,
            eventtypes.PermissionsAllowLocalRenameDeleteKey:  cfg.APIServer.Permissions.AllowLocalRenameDelete,
            eventtypes.PermissionsAllowRemoteRenameDeleteKey: cfg.APIServer.Permissions.AllowRemoteRenameDelete,
        }
    }

    txProfileData := make(map[string]map[string]string)
    for txProfileName, txProfile := range cfg.Protocols.S3.TransferProfiles {
        txProfileData[txProfileName] = map[string]string{
            "local":  txProfile.Paths.Local,
            "remote": txProfile.Paths.Remote,
        }
    }

    var hotFolderSourceDirectories []string
    for _, hotFolder := range cfg.UploadHotFolders {
        if hotFolder.Enabled {
            hotFolderSourceDirectories = append(hotFolderSourceDirectories, hotFolder.LocalSourceFolder)
        }
    }

    homeDir, err := os.UserHomeDir()
    if err != nil {
        fmt.Println(err)
    }

    return eventtypes.MetadataEvent{
        DaemonMode:                 global.GetDaemonMode(),
        TransferProfiles:           txProfileData,
        CPUCoreCount:               systeminfo.GetCoreCount(),
        Version:                    global.GetVersion(),
        Permissions:                permissionsData,
        HomePath:                   fs.ConvertPathToGRPC(homeDir),
        DaemonOS:                   runtime.GOOS,
        AwsProfiles:                loadAWSProfiles(),
        HotFolderSourceDirectories: hotFolderSourceDirectories,
    }
}
