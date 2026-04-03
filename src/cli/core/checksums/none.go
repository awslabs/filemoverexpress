package checksums

type NoneChecksummer struct {
}

func (*NoneChecksummer) ChecksumFile(_ string) (string, error) {
    return "", nil
}
