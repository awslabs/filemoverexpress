package mhl

//revive:disable:line-length-limit
const (
    strFailedReadingXML           = "Failed to read XML in file %s: %s"
    strFailedParsingMhl           = "Failed to parse MHL file %s: %s"
    strNoMHLChecksumFound         = "no <md5>, <xxhash>, <xxhash64>, or <xxh3> element found for file. Adding to checksum queue: %s"
    strMhlReferencesMissingFile   = "MHL file %s references missing file %s"
    strFailedProcessingMhlElement = "failed to process %s from MHL file %s: %s"
    strFileChanged                = "%s referenced in MHL %s has changed since MHL creation"
)
