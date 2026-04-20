package constants

const (
	AlgorithmMD5      ChecksumAlgorithm = "md5-hex"
	AlgorithmXXHash   ChecksumAlgorithm = "xxhash"
	AlgorithmXXHash64 ChecksumAlgorithm = "xxhash64"
	AlgorithmXXH3     ChecksumAlgorithm = "xxh3"
	AlgorithmNone     ChecksumAlgorithm = "none"
)

type (
	ChecksumAlgorithm string
)
