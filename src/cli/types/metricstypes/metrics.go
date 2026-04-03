package metricstypes

type (
    MetricsRequestData struct {
        Date            string `json:"date"`
        BytesUploaded   int64  `json:"bytesUploaded"`
        BytesDownloaded int64  `json:"bytesDownloaded"`
        ClientID        string `json:"clientId"`
        Version         string `json:"version"`
        Region          string `json:"region"`
        StorageClass    string `json:"storageClass"`
        Bucket          string `json:"bucket"`
    }

    MetricsData struct {
        Bucket          string
        BytesUploaded   int64
        BytesDownloaded int64
        Region          string
        StorageClass    string
    }
)
