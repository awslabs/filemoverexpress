package checksums

type FileMoverChecksummer interface {
    ChecksumFile(string) (string, error)
}
