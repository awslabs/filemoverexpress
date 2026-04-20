package crypto

import (
	"testing"
)

func TestEncryptDecryptRoundTrip(t *testing.T) {
	secret := "my-secret-key"
	plaintext := "hello, world"

	encrypted, err := EncryptPSK(secret, plaintext)
	if err != nil {
		t.Fatalf("EncryptPSK failed: %v", err)
	}

	decrypted, err := DecryptPSK(secret, encrypted)
	if err != nil {
		t.Fatalf("DecryptPSK failed: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("expected %q, got %q", plaintext, decrypted)
	}
}

func TestDecryptWithWrongSecret(t *testing.T) {
	encrypted, err := EncryptPSK("correct-secret", "sensitive data")
	if err != nil {
		t.Fatalf("EncryptPSK failed: %v", err)
	}

	_, err = DecryptPSK("wrong-secret", encrypted)
	if err == nil {
		t.Error("expected error when decrypting with wrong secret")
	}
}

func TestDecryptInvalidBase64(t *testing.T) {
	_, err := DecryptPSK("secret", "not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64 input")
	}
}

func TestEncryptProducesDifferentCiphertexts(t *testing.T) {
	secret := "my-secret"
	plaintext := "same input"

	enc1, _ := EncryptPSK(secret, plaintext)
	enc2, _ := EncryptPSK(secret, plaintext)

	if enc1 == enc2 {
		t.Error("expected different ciphertexts due to random nonce")
	}
}
