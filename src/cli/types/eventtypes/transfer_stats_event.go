package eventtypes

import (
    "fmt"

    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/safeconv"
)

type TransferStatsEvent struct {
    ActiveDownloads      int
    ActiveUploads        int
    DownloadBps          int64
    UploadBps            int64
    TotalBytesDownloaded int64
    TotalBytesUploaded   int64
}

func (te *TransferStatsEvent) String() string {
    return fmt.Sprintf(
        "Active Downloads: %d, Avg. Download Speed: %s/s, Total Transferred: %s | "+
            "Active Uploads: %d, Avg. Upload Speed: %s/s, Total Transferred: %s",
        te.ActiveDownloads,
        utils.FormatBytes(te.DownloadBps),
        utils.FormatBytes(te.TotalBytesDownloaded),
        te.ActiveUploads,
        utils.FormatBytes(te.UploadBps),
        utils.FormatBytes(te.TotalBytesUploaded),
    )
}

func (*TransferStatsEvent) Type() MessageFlags {
    return TransferStatsEventType
}

func (*TransferStatsEvent) Priority() logger.LogLevel {
    return TransferStatsEventPriority
}

func (te *TransferStatsEvent) ToProtobuf() (fmev1.PbEvent, fmev1.EventType) {
    // Safe conversions for transfer stats - Issues #9, #10
    activeDownloads, err := safeconv.IntToInt32(te.ActiveDownloads)
    if err != nil {
        logger.Error("Invalid ActiveDownloads value %d: %v, using 0", te.ActiveDownloads, err)
        activeDownloads = 0
    }

    activeUploads, err := safeconv.IntToInt32(te.ActiveUploads)
    if err != nil {
        logger.Error("Invalid ActiveUploads value %d: %v, using 0", te.ActiveUploads, err)
        activeUploads = 0
    }

    pbEvt := fmev1.TransferStatsEvent{
        ActiveDownloads:      activeDownloads,
        ActiveUploads:        activeUploads,
        DownloadBps:          te.DownloadBps,
        UploadBps:            te.UploadBps,
        TotalBytesDownloaded: te.TotalBytesDownloaded,
        TotalBytesUploaded:   te.TotalBytesUploaded,
    }

    ler := fmev1.ListEventsResponse_TransferStatsEvent{TransferStatsEvent: &pbEvt}
    return &ler, fmev1.EventType_EVENT_TYPE_TRANSFER_STATS_EVENT_TYPE
}
