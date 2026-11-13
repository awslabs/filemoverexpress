package checksums

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
)

// C4 reference vectors are taken from the canonical implementation at
// https://github.com/Avalanche-io/c4 (id_test.go). They pin the SHA-512 +
// fixed-width base58 encoding so an accidental change to the alphabet, padding,
// or digest cannot pass unnoticed.
func TestC4ChecksumFile(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    string
	}{
		{
			name:    "empty file (ID of nothing)",
			content: "",
			want:    "c459dsjfscH38cYeXXYogktxf4Cd9ibshE3BHUo6a58hBXmRQdZrAkZzsWcbWtDg5oQstpDuni4Hirj75GEmTc1sFT",
		},
		{
			name:    "foo",
			content: "foo",
			want:    "c45xZeXwMSpqXjpDumcHMA6mhoAmGHkUo7r9WmN2UgSEQzj9KjgseaQdkEJ11fGb5S1WEENcV3q8RFWwEeVpC7Fjk2",
		},
		{
			name:    "bravo",
			content: "bravo",
			want:    "c42jd8KUQG9DKppN1qt5aWS3PAmdPmNutXyVTb8H123FcuU3shPxpUXsVdcouSALZ4PaDvMYzQSMYCWkb6rop9zhDa",
		},
		{
			name:    "charlie",
			content: "charlie",
			want:    "c44erLietE8C1iKmQ3y4ENqA9g82Exdkoxox3KEHops2ux5MTsuMjfbFRvUPsPdi9Pxc3C2MRvLxWT8eFw5XKbRQGw",
		},
		{
			name:    "alfa",
			content: "alfa",
			want:    "c43zYcLni5LF9rR4Lg4B8h3Jp8SBwjcnyyeh4bc6gTPHndKuKdjUWx1kJPYhZxYt3zV6tQXpDs2shPsPYjgG81wZM1",
		},
		{
			name:    "pretend asset file",
			content: "This is a pretend asset file, for testing asset id generation.\n",
			want:    "c43ucjRutKqZSCrW43QGU1uwRZTGoVD7A7kPHKQ1z4X1Ge8mhW4Q1gk48Ld8VFpprQBfUC8JNvHYVgq453hCFrgf9D",
		},
	}

	c := &C4Checksummer{}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "asset")
			require.NoError(t, os.WriteFile(path, []byte(tc.content), 0o600))

			got, err := c.ChecksumFile(path)
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
			assert.Len(t, got, 90, "a C4 ID is always 90 characters")
		})
	}
}

// TestEncodeC4FixedWidth covers the two boundary digests: an all-zero digest
// must left-pad to 88 '1' characters, and an all-0xFF digest must produce the
// maximum C4 ID. Both are reference vectors from the canonical implementation.
func TestEncodeC4FixedWidth(t *testing.T) {
	zero := make([]byte, 64)
	assert.Equal(t,
		"c41111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
		encodeC4(zero),
	)

	maxDigest := bytes.Repeat([]byte{0xFF}, 64)
	assert.Equal(t,
		"c467rpwLCuS5DGA8KGZXKsVQ7dnPb9goRLoKfgGbLfQg9WoLUgNY77E2jT11fem3coV9nAkguBACzrU1iyZM4B8roQ",
		encodeC4(maxDigest),
	)
}

func TestNewChecksummerReturnsC4(t *testing.T) {
	c, err := NewChecksummer(constants.AlgorithmC4)
	require.NoError(t, err)
	assert.IsType(t, &C4Checksummer{}, c)

	path := filepath.Join(t.TempDir(), "asset")
	require.NoError(t, os.WriteFile(path, []byte("foo"), 0o600))

	got, err := c.ChecksumFile(path)
	require.NoError(t, err)
	assert.Equal(t, "c45xZeXwMSpqXjpDumcHMA6mhoAmGHkUo7r9WmN2UgSEQzj9KjgseaQdkEJ11fGb5S1WEENcV3q8RFWwEeVpC7Fjk2", got)
}

func TestC4ChecksumFileMissing(t *testing.T) {
	c := &C4Checksummer{}
	_, err := c.ChecksumFile(filepath.Join(t.TempDir(), "does-not-exist"))
	assert.Error(t, err)
}
