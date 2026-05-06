package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/xuri/excelize/v2"
)

// ExportJobList maps job IDs to their export data.
type ExportJobList map[string]ExportJobData

// ExportJobData holds the metadata and tasks for a single job export.
type ExportJobData struct {
	JobName             string     `json:"jobName"`
	Direction           string     `json:"direction"`
	TransferProfileName string     `json:"transferProfileName"`
	Bucket              string     `json:"bucket"`
	Transfers           []TaskData `json:"transfers"`
}

// TaskData represents a single transfer task as received from the frontend.
type TaskData struct {
	TaskID           string       `json:"taskId"`
	Destination      string       `json:"destination"`
	LocalFile        FileInfo     `json:"localFile"`
	S3Object         S3ObjectInfo `json:"s3Object"`
	Direction        string       `json:"direction"`
	Status           string       `json:"status"`
	StatusMessage    string       `json:"statusMessage"`
	JobID            string       `json:"jobId"`
	Checksum         string       `json:"checksum"`
	Priority         int          `json:"priority"`
	Error            string       `json:"error"`
	BytesTransferred int64        `json:"bytesTransferred"`
}

// FileInfo represents a local file reference within a task.
type FileInfo struct {
	Path         string `json:"path"`
	Size         int64  `json:"size"`
	LastModified string `json:"lastModified"`
}

// S3ObjectInfo represents an S3 object reference within a task.
type S3ObjectInfo struct {
	Key          string `json:"key"`
	Size         int64  `json:"size"`
	LastModified string `json:"lastModified"`
}

// flatRow holds one flattened row ready for export.
type flatRow struct {
	TaskID           string
	Destination      string
	Source           string
	Size             int64
	LastModified     string
	Direction        string
	Status           string
	StatusMessage    string
	JobID            string
	Checksum         string
	Priority         int
	Error            string
	BytesTransferred int64
}

var (
	sheetNameInvalidChars = regexp.MustCompile(`[/\\?*:\[\]]`)
	csvHeaders            = []string{
		"jobName", "direction", "remoteConfigurationName",
		"jobId", "taskId", "destination", "source", "size",
		"lastModified", "status", "statusMessage", "checksum",
		"priority", "error", "bytesTransferred",
	}
)

// GenerateExcelReport produces a base64-encoded XLSX from the given job data.
func (a *FMEApp) GenerateExcelReport(data ExportJobList) (string, error) {
	if len(data) == 0 {
		return "", nil
	}

	f := excelize.NewFile()
	defer f.Close()

	sheetNames := make(map[string]int)
	first := true

	for _, job := range data {
		name := uniqueSheetName(sanitizeSheetName(job.JobName, job.Direction), sheetNames)

		if first {
			f.SetSheetName("Sheet1", name)
			first = false
		} else {
			f.NewSheet(name)
		}

		rows := flattenTasks(job)
		writeExcelHeaders(f, name)
		writeExcelRows(f, name, rows)
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return "", fmt.Errorf("write xlsx: %w", err)
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// GenerateCsvReport produces a base64-encoded CSV from the given job data.
func (a *FMEApp) GenerateCsvReport(data ExportJobList) string {
	if len(data) == 0 {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(strings.Join(csvHeaders, ","))

	for _, job := range data {
		rows := flattenTasks(job)
		for _, r := range rows {
			sb.WriteString("\r\n")
			sb.WriteString(strings.Join([]string{
				csvQuote(job.JobName),
				csvQuote(job.Direction),
				csvQuote(job.TransferProfileName),
				csvQuote(r.JobID),
				csvQuote(r.TaskID),
				csvQuote(r.Destination),
				csvQuote(r.Source),
				fmt.Sprintf("%d", r.Size),
				csvQuote(r.LastModified),
				csvQuote(r.Status),
				csvQuote(r.StatusMessage),
				csvQuote(r.Checksum),
				fmt.Sprintf("%d", r.Priority),
				csvQuote(r.Error),
				fmt.Sprintf("%d", r.BytesTransferred),
			}, ","))
		}
	}

	return base64.StdEncoding.EncodeToString([]byte(sb.String()))
}

// GenerateJsonReport produces a base64-encoded JSON from the given job data.
func (a *FMEApp) GenerateJsonReport(data ExportJobList) string {
	if len(data) == 0 {
		return ""
	}

	b, _ := json.Marshal(data)
	return base64.StdEncoding.EncodeToString(b)
}

func flattenTasks(job ExportJobData) []flatRow {
	rows := make([]flatRow, 0, len(job.Transfers))
	for _, t := range job.Transfers {
		rows = append(rows, flattenTask(t, job.Bucket))
	}
	return rows
}

func flattenTask(t TaskData, bucket string) flatRow {
	r := flatRow{
		TaskID:           t.TaskID,
		Direction:        t.Direction,
		Status:           t.Status,
		StatusMessage:    t.StatusMessage,
		JobID:            t.JobID,
		Checksum:         t.Checksum,
		Priority:         t.Priority,
		Error:            t.Error,
		BytesTransferred: t.BytesTransferred,
	}

	switch strings.ToLower(t.Direction) {
	case "upload":
		if bucket != "" {
			r.Destination = "s3://" + bucket + "/" + cleanPath(t.Destination)
		} else {
			r.Destination = t.Destination
		}
		r.Source = t.LocalFile.Path
		r.Size = t.LocalFile.Size
		r.LastModified = t.LocalFile.LastModified
	case "download":
		r.Destination = t.Destination
		if bucket != "" {
			r.Source = "s3://" + bucket + "/" + cleanPath(t.S3Object.Key)
		} else {
			r.Source = t.S3Object.Key
		}
		r.Size = t.S3Object.Size
		r.LastModified = t.S3Object.LastModified
	}

	return r
}

func cleanPath(path string) string {
	parts := strings.Split(path, "/")
	filtered := parts[:0]
	for _, p := range parts {
		if p != "" {
			filtered = append(filtered, p)
		}
	}
	return strings.Join(filtered, "/")
}

func sanitizeSheetName(jobName, direction string) string {
	name := jobName
	if len(name) > 20 {
		name = name[:17] + "..."
	}
	name = sheetNameInvalidChars.ReplaceAllString(name, "_")

	label := "upload"
	if strings.EqualFold(direction, "download") {
		label = "download"
	}

	return name + " (" + label + ")"
}

func uniqueSheetName(name string, seen map[string]int) string {
	seen[name]++
	if seen[name] == 1 {
		return name
	}
	return fmt.Sprintf("%s_%d", name, seen[name])
}

func writeExcelHeaders(f *excelize.File, sheet string) {
	headers := []string{
		"taskId", "destination", "source", "size", "lastModified",
		"direction", "status", "statusMessage", "jobId",
		"checksum", "priority", "error", "bytesTransferred",
	}
	for col, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		f.SetCellValue(sheet, cell, h)
	}
}

func writeExcelRows(f *excelize.File, sheet string, rows []flatRow) {
	for i, r := range rows {
		row := i + 2
		f.SetCellValue(sheet, cellName(1, row), r.TaskID)
		f.SetCellValue(sheet, cellName(2, row), r.Destination)
		f.SetCellValue(sheet, cellName(3, row), r.Source)
		f.SetCellValue(sheet, cellName(4, row), r.Size)
		f.SetCellValue(sheet, cellName(5, row), r.LastModified)
		f.SetCellValue(sheet, cellName(6, row), r.Direction)
		f.SetCellValue(sheet, cellName(7, row), r.Status)
		f.SetCellValue(sheet, cellName(8, row), r.StatusMessage)
		f.SetCellValue(sheet, cellName(9, row), r.JobID)
		f.SetCellValue(sheet, cellName(10, row), r.Checksum)
		f.SetCellValue(sheet, cellName(11, row), r.Priority)
		f.SetCellValue(sheet, cellName(12, row), r.Error)
		f.SetCellValue(sheet, cellName(13, row), r.BytesTransferred)
	}
}

func cellName(col, row int) string {
	name, _ := excelize.CoordinatesToCellName(col, row)
	return name
}

func csvQuote(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `""`) + `"`
}
