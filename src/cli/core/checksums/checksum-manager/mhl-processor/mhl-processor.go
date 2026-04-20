package mhl_processor

import (
	"path/filepath"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/jobmanagertypes"
	"github.com/awslabs/filemoverexpress/utils/mhl"
)

// ProcessMHLFiles will go through and detect any MHL files present in a slice of tasks and returns a map with the relative file path as
// the key, and the value will be the requested checksum value. If the requested checksum algorithm is not detected in the MHL file, it will
// be treated as if the file did not appear in the MHL (i.e. FME configuration wants XXHash checksums, but MHL contains MD5)
func ProcessMHLFiles(tasks []*jobmanagertypes.Task, algorithm constants.ChecksumAlgorithm) (map[string]string, []error) {
	result := make(map[string]string)
	mhlErrors := make([]error, 0)
	for _, task := range tasks {
		localFilePath := task.LocalFile().Path
		if filepath.Ext(localFilePath) == ".mhl" {
			mhlBasePath := filepath.Dir(localFilePath)
			hashList, err := mhl.LoadMHLFile(localFilePath)
			if err != nil {
				mhlErrors = append(mhlErrors, err)
				continue
			}

			for _, itm := range hashList.HashList {
				itmFullPath := filepath.Clean(filepath.Join(mhlBasePath, itm.File))
				switch algorithm {
				case "md5-hex":
					if itm.MD5 != "" {
						result[itmFullPath] = itm.MD5
					}
				case "xxhash":
					if itm.XXHash != "" {
						result[itmFullPath] = itm.XXHash
					}
				case "xxhash64":
					if itm.XXHash64 != "" {
						result[itmFullPath] = itm.XXHash64
					}
				case "xxh3":
					if itm.XXH3 != "" {
						result[itmFullPath] = itm.XXH3
					}
				}
			}
		}
	}

	return result, mhlErrors
}
