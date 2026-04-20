package mock

const (
	UniteTestMockAWSProfile                   string = "test-profile"
	UnitTestMockBucket                        string = "my-bucket"
	UnitTestMockRegion                        string = "us-west-2"
	UnitTestMockEndpoint                      string = "https://localhost:8080/"
	UnitTestFolderPrefix                      string = "unit_test_folder/"
	UnitTestFileName                          string = "1mb_file.txt"
	UnitTestFileNameWithPrefix                       = UnitTestFolderPrefix + UnitTestFileName
	UnitTestLastModifiedForPrefix             string = "2023-09-12T01:10:07Z"
	UnitTestLastModifiedForFilePathWithPrefix string = "2023-09-11T01:15:07Z"
	UnitTestETagForPrefix                     string = "fde7bae894627c44f49bf905c5c14110"
	UnitTestETagForFilePathWithPrefix         string = "cb06563e65922e2582b832bc21965477"
)
