package transfer_api

import (
    "regexp"
    "strings"
)

var (
    s3ValidKey             = regexp.MustCompile(`^[a-zA-Z0-9!_.*'() -]+(/[a-zA-Z0-9!_.*'() -]+)*$`)
    ContainsMultipleSpaces = regexp.MustCompile(" {2,}")
)

func ContainsUnsafeS3Chars(path string) bool {
    if ContainsMultipleSpaces.MatchString(path) {
        return true
    }
    return !s3ValidKey.MatchString(path)
}

// FormatAsS3Prefix processes an S3 path to be an S3 prefix path, which has no leading slashes and has a trailing slash
func FormatAsS3Prefix(s3Path string) string {
    return strings.Trim(s3Path, "/") + "/"
}

// FormatAsS3Object processes an S3 path to be an S3 object path, which has no leading slashes or trailing slashes
func FormatAsS3Object(s3Path string) string {
    return strings.Trim(s3Path, "/")
}
