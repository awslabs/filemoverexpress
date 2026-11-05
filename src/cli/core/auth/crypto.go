package auth

// EncryptSecret encrypts plaintext with the same platform machine-key scheme used
// for the OIDC token cache (AES-256-GCM keyed from the machine ID on unix, DPAPI
// on Windows). It is exported so other on-endpoint secret stores - for example the
// webhook notification URL store - reuse one crypto path rather than duplicating it.
func EncryptSecret(plaintext []byte) ([]byte, error) {
	return encryptData(plaintext)
}

// DecryptSecret reverses EncryptSecret for data produced on the same machine/user.
func DecryptSecret(encrypted []byte) ([]byte, error) {
	return decryptData(encrypted)
}
