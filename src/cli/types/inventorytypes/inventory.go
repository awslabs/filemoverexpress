package inventorytypes

import (
	"encoding/xml"
	"time"

	"github.com/awslabs/filemoverexpress/types/checksumtypes"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

type (
	S3Object struct {
		Key          string                  `json:"object_key" yaml:"object_key" xml:"object_key"`
		Size         uint64                  `json:"object_size" yaml:"object_size" xml:"object_size"`
		LastModified *time.Time              `json:"last_modified" yaml:"last_modified" xml:"last_modified"`
		Checksums    *checksumtypes.Checksum `json:"checksums,omitempty" yaml:"checksums,omitempty" xml:"checksums,omitempty"`
	}
	ChecksumResult struct {
		Key      string                  `json:"checksum_type,omitempty" yaml:"checksum_type,omitempty" xml:"checksum_type,omitempty"`
		Checksum *checksumtypes.Checksum `json:"checksum,omitempty" yaml:"checksum,omitempty" xml:"checksum,omitempty"`
	}
	GenerateInventoryInput struct {
		TransferProfile  configtypes.TransferProfile
		OutputFormat     string
		Pretty           bool
		IncludeChecksums bool
	}

	InventoryXMLInput struct {
		XMLName   xml.Name    `xml:"inventory"`
		S3Objects *[]S3Object `xml:"s3_object"`
	}
)
