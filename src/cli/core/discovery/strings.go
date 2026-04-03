package discovery

const (
    StrSourceDoesNotExists          string = "source %s doesn't exist, ignoring"
    StrFailedGettingFileInfo        string = "failed getting file info for %s: %s"
    StrFailedCalculatingDestination string = "failed calculating S3 destination for %s: %s"
    StrFailedListingDir             string = "failed listing content of folder: %s"
    StrPathTooLong                  string = "max path length exceeded: %s"
    StrFailedListingS3Objects       string = "cannot list s3 objects by the path %s"
    StrDownloadGlacierFileError            = "unable to download %s as it was uploaded with unsupported storage class %s"
    StrKeyContainsSlash                    = "S3 key %s contains invalid characters. Setting destination file to be named %s"
    StrTestJobId                    string = "test-id"
    StrTestPrefix                   string = "testPrefix"
    StrTestDestinationFolder        string = "testDestinationFolder"
    StrTestLongFileName             string = "testdata/discovery/too-long-filename" +
        "/abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd" +
        "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd" +
        "abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcda"
    StrContainsUnsafeChars = "%s contains characters that aren't recommended for S3 use. See https://docs.aws.amazon." +
        "com/AmazonS3/latest/userguide/object-keys.html for more information."
)
