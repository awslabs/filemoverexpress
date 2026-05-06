package main

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

func sampleData() ExportJobList {
	return ExportJobList{
		"job-1": {
			JobName:             "MyJob",
			Direction:           "upload",
			TransferProfileName: "profile-1",
			Bucket:              "my-bucket",
			Transfers: []TaskData{
				{
					TaskID:           "task-1",
					Destination:      "/prefix/dest/",
					LocalFile:        FileInfo{Path: "/local/file.mov", Size: 1024, LastModified: "2024-01-15T10:00:00Z"},
					S3Object:         S3ObjectInfo{},
					Direction:        "upload",
					Status:           "completed",
					StatusMessage:    "done",
					JobID:            "job-1",
					Checksum:         "abc123",
					Priority:         1,
					Error:            "",
					BytesTransferred: 1024,
				},
			},
		},
		"job-2": {
			JobName:             "DownloadJob",
			Direction:           "download",
			TransferProfileName: "profile-2",
			Bucket:              "dl-bucket",
			Transfers: []TaskData{
				{
					TaskID:      "task-2",
					Destination: "/local/output",
					LocalFile:   FileInfo{},
					S3Object:    S3ObjectInfo{Key: "//folder//key.mxf", Size: 2048, LastModified: "2024-02-20T12:00:00Z"},
					Direction:   "download",
					Status:      "completed",
					JobID:       "job-2",
					Priority:    2,
				},
			},
		},
	}
}

func TestCleanPath(t *testing.T) {
	tests := []struct {
		input, expected string
	}{
		{"/prefix/dest/", "prefix/dest"},
		{"//folder//key.mxf", "folder/key.mxf"},
		{"simple", "simple"},
		{"", ""},
		{"a/b/c", "a/b/c"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.expected, cleanPath(tt.input))
	}
}

func TestSanitizeSheetName(t *testing.T) {
	assert.Equal(t, "Short (upload)", sanitizeSheetName("Short", "upload"))
	assert.Equal(t, "Short (download)", sanitizeSheetName("Short", "download"))

	long := "ThisIsAVeryLongJobName"
	result := sanitizeSheetName(long, "upload")
	assert.Equal(t, "ThisIsAVeryLongJo... (upload)", result)

	assert.Equal(t, "a_b_c (upload)", sanitizeSheetName("a/b:c", "upload"))
}

func TestUniqueSheetName(t *testing.T) {
	seen := make(map[string]int)
	assert.Equal(t, "Sheet (upload)", uniqueSheetName("Sheet (upload)", seen))
	assert.Equal(t, "Sheet (upload)_2", uniqueSheetName("Sheet (upload)", seen))
	assert.Equal(t, "Sheet (upload)_3", uniqueSheetName("Sheet (upload)", seen))
}

func TestFlattenTaskUpload(t *testing.T) {
	task := TaskData{
		TaskID:           "t1",
		Destination:      "/prefix/path/",
		LocalFile:        FileInfo{Path: "/local/f.mov", Size: 100, LastModified: "2024-01-01T00:00:00Z"},
		S3Object:         S3ObjectInfo{Key: "ignored"},
		Direction:        "upload",
		Status:           "completed",
		JobID:            "j1",
		BytesTransferred: 100,
	}

	r := flattenTask(task, "bucket")
	assert.Equal(t, "s3://bucket/prefix/path", r.Destination)
	assert.Equal(t, "/local/f.mov", r.Source)
	assert.Equal(t, int64(100), r.Size)
	assert.Equal(t, "2024-01-01T00:00:00Z", r.LastModified)
}

func TestFlattenTaskDownload(t *testing.T) {
	task := TaskData{
		TaskID:      "t2",
		Destination: "/local/out",
		LocalFile:   FileInfo{},
		S3Object:    S3ObjectInfo{Key: "folder/key.mxf", Size: 200, LastModified: "2024-06-01T00:00:00Z"},
		Direction:   "Download",
		Status:      "completed",
		JobID:       "j2",
	}

	r := flattenTask(task, "bucket")
	assert.Equal(t, "/local/out", r.Destination)
	assert.Equal(t, "s3://bucket/folder/key.mxf", r.Source)
	assert.Equal(t, int64(200), r.Size)
	assert.Equal(t, "2024-06-01T00:00:00Z", r.LastModified)
}

func TestFlattenTaskNoBucket(t *testing.T) {
	upload := flattenTask(TaskData{Destination: "dest", Direction: "upload", LocalFile: FileInfo{Path: "src"}}, "")
	assert.Equal(t, "dest", upload.Destination)

	download := flattenTask(TaskData{Destination: "dest", Direction: "download", S3Object: S3ObjectInfo{Key: "key"}}, "")
	assert.Equal(t, "key", download.Source)
}

func TestGenerateExcelReport(t *testing.T) {
	app := &FMEApp{}
	data := sampleData()

	result, err := app.GenerateExcelReport(data)
	require.NoError(t, err)
	require.NotEmpty(t, result)

	raw, err := base64.StdEncoding.DecodeString(result)
	require.NoError(t, err)

	f, err := excelize.OpenReader(strings.NewReader(string(raw)))
	require.NoError(t, err)
	defer f.Close()

	sheets := f.GetSheetList()
	assert.Len(t, sheets, 2)
}

func TestGenerateExcelReportEmpty(t *testing.T) {
	app := &FMEApp{}
	result, err := app.GenerateExcelReport(ExportJobList{})
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestGenerateCsvReport(t *testing.T) {
	app := &FMEApp{}
	data := sampleData()

	result := app.GenerateCsvReport(data)
	require.NotEmpty(t, result)

	raw, err := base64.StdEncoding.DecodeString(result)
	require.NoError(t, err)

	lines := strings.Split(string(raw), "\r\n")
	assert.GreaterOrEqual(t, len(lines), 3) // header + 2 data rows
	assert.Equal(t, strings.Join(csvHeaders, ","), lines[0])
}

func TestGenerateCsvReportEmpty(t *testing.T) {
	app := &FMEApp{}
	assert.Empty(t, app.GenerateCsvReport(ExportJobList{}))
}

func TestGenerateJsonReport(t *testing.T) {
	app := &FMEApp{}
	data := sampleData()

	result := app.GenerateJsonReport(data)
	require.NotEmpty(t, result)

	raw, err := base64.StdEncoding.DecodeString(result)
	require.NoError(t, err)

	var parsed ExportJobList
	require.NoError(t, json.Unmarshal(raw, &parsed))
	assert.Len(t, parsed, 2)
}

func TestGenerateJsonReportEmpty(t *testing.T) {
	app := &FMEApp{}
	assert.Empty(t, app.GenerateJsonReport(ExportJobList{}))
}

func TestCsvQuote(t *testing.T) {
	assert.Equal(t, `"hello"`, csvQuote("hello"))
	assert.Equal(t, `"say ""hi"""`, csvQuote(`say "hi"`))
	assert.Equal(t, `""`, csvQuote(""))
}
