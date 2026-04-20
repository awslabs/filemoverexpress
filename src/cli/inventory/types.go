package inventory

import (
	"github.com/awslabs/filemoverexpress/types/inventorytypes"
)

type (
	outputFileSettings struct {
		s3Objects        *[]inventorytypes.S3Object
		pretty           bool
		includeChecksums bool
	}
)
