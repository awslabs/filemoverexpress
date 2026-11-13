package checksums

import (
	"crypto/sha512"
	"io"
	"math/big"
	"os"

	"github.com/sethvargo/go-retry"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/utils/fs"
)

// c4Alphabet is the base58 alphabet used by the C4 ID encoding. It is the same
// alphabet Bitcoin uses: the digits deliberately omit 0, O, I and l to avoid
// visual ambiguity.
const c4Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// c4Base is the radix of the C4 encoding.
const c4Base = 58

// c4BodyLength is the fixed number of base58 characters that follow the "c4"
// prefix. A C4 ID is always 90 characters: the 2-character prefix plus 88
// left-padded base58 digits of the SHA-512 digest.
const c4BodyLength = 88

// C4Checksummer produces an ASC MHL "c4" content identifier: the SHA-512 digest
// of the file encoded as a fixed-width 88-character base58 string and prefixed
// with "c4". See https://github.com/Avalanche-io/c4 for the reference
// implementation and the test vectors this is verified against.
type C4Checksummer struct {
}

func (*C4Checksummer) ChecksumFile(path string) (string, error) {
	fh, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", err
		}
		return "", retry.RetryableError(err)
	}

	defer fs.CloseFile(fs.CloseFileInput{
		File: fh,
		Exit: false,
	})

	h := sha512.New()
	if _, err = io.Copy(h, fh); err != nil {
		events.Events.Error(strFailedChecksum, fh.Name(), err)
		return "", retry.RetryableError(err)
	}

	return encodeC4(h.Sum(nil)), nil
}

// encodeC4 encodes a SHA-512 digest as a C4 ID string. The digest is treated as
// a big-endian unsigned integer, base58-encoded, and left-padded with the zero
// digit ('1') to a fixed width of 88 characters, so every C4 ID is exactly 90
// characters long (the "c4" prefix plus 88 body characters).
func encodeC4(digest []byte) string {
	num := new(big.Int).SetBytes(digest)
	base := big.NewInt(c4Base)
	mod := new(big.Int)

	body := make([]byte, c4BodyLength)
	for i := c4BodyLength - 1; i >= 0; i-- {
		num.DivMod(num, base, mod)
		body[i] = c4Alphabet[mod.Int64()]
	}

	return "c4" + string(body)
}
