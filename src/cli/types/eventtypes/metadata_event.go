package eventtypes

import (
	"fmt"
	"strings"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

const (
	PermissionsAllowUIConfigKey           = "allow_ui_configuration"
	PermissionsAllowLocalRenameDeleteKey  = "allow_local_rename_delete"
	PermissionsAllowRemoteRenameDeleteKey = "allow_remote_rename_delete"
)

type MetadataEvent struct {
	DaemonMode                 bool
	TransferProfiles           map[string]map[string]string
	CPUCoreCount               int32
	Version                    string
	HomePath                   string
	DaemonOS                   string
	ConnectionEvent            bool
	AwsProfiles                []string
	HotFolderSourceDirectories []string
	Permissions                map[string]bool
}

func (e *MetadataEvent) String() string {
	transferProfileNames := make([]string, 0)
	for txPrf := range e.TransferProfiles {
		transferProfileNames = append(transferProfileNames, txPrf)
	}
	return fmt.Sprintf("Connection event: %t, Version: %s, Daemon mode: %t, CPU Cores: %d, Allow UI Config: %t, "+
		"Allow Local Rename and Delete: %t, Allow Remote Rename and Delete: %t, Transfer Profiles: %s, "+
		"Daemon OS: %s, AWS Profiles: %s",
		e.ConnectionEvent,
		e.Version,
		e.DaemonMode,
		e.CPUCoreCount,
		e.Permissions[PermissionsAllowUIConfigKey],
		e.Permissions[PermissionsAllowLocalRenameDeleteKey],
		e.Permissions[PermissionsAllowRemoteRenameDeleteKey],
		strings.Join(transferProfileNames, ", "),
		e.DaemonOS,
		strings.Join(e.AwsProfiles, ", "),
	)
}

func (*MetadataEvent) Type() MessageFlags {
	return MetadataEventType
}

func (*MetadataEvent) Priority() logger.LogLevel {
	return MetadataEventPriority
}

func (e *MetadataEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
	txProfiles := make(map[string]*fmev1.MetadataTransferProfile)

	for txProfileName, txProfile := range e.TransferProfiles {
		txProfiles[txProfileName] = &fmev1.MetadataTransferProfile{
			Remote: txProfile["remote"],
			Local:  txProfile["local"],
		}
	}
	pbEvent := &fmev1.MetadataEvent{
		DaemonMode:                 e.DaemonMode,
		TransferProfiles:           txProfiles,
		CpuCoreCount:               e.CPUCoreCount,
		Version:                    e.Version,
		Permissions:                e.Permissions,
		HomePath:                   e.HomePath,
		DaemonOs:                   e.DaemonOS,
		ConnectionEvent:            e.ConnectionEvent,
		AwsProfiles:                e.AwsProfiles,
		HotFolderSourceDirectories: e.HotFolderSourceDirectories,
	}
	msgEvent := fmev1.ListEventsResponse_MetadataEvent{MetadataEvent: pbEvent}
	return &msgEvent, fmev1.EventType_EVENT_TYPE_METADATA_EVENT_TYPE
}
