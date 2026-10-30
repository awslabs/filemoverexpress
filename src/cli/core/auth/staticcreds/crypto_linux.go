//go:build linux

package staticcreds

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/google/go-tpm/tpm2"
	"github.com/google/go-tpm/tpm2/transport"
	"github.com/google/go-tpm/tpm2/transport/linuxtpm"
	"golang.org/x/crypto/hkdf"

	"github.com/awslabs/filemoverexpress/config"
)

// TPM-sealed key derivation (Linux). When the host has a usable TPM 2.0, the AES key is derived from
// a random 32-byte seed that is SEALED to the TPM: the seed is generated once, sealed under a storage
// root key that never leaves the chip, and the sealed blob is persisted next to the credentials. The
// plaintext seed only ever exists transiently in memory after the TPM unseals it, so - unlike the
// machine-ID derivation - the key cannot be reconstructed from host data copied off the machine.
//
// If no TPM is present, or any TPM step fails, preferredKey falls back to the machine-ID method so
// credentials remain storable; a half-working TPM never makes the app unusable.

const (
	tpmResourceMgrDevice = "/dev/tpmrm0" // kernel-arbitrated TPM device, preferred
	tpmRawDevice         = "/dev/tpm0"   // raw device, fallback
	tpmSeedFileName      = ".tpm-seed"   // sealed-seed blob, stored in the credentials dir
	tpmSeedSize          = 32
)

// preferredKey selects TPM-sealed derivation when a usable TPM is present, else the machine-ID key.
func preferredKey(create bool) (byte, []byte, error) {
	if tpmDevicePath() != "" {
		if key, err := deriveTPMKey(create); err == nil {
			return methodTPM, key, nil
		}
		// TPM present but unusable (locked, no permissions, in-use): fall back rather than fail, so
		// the user can still store credentials. The blob records methodMachineID accordingly.
	}
	key, err := deriveMachineIDKey()
	return methodMachineID, key, err
}

// tpmDevicePath returns the first available TPM device path, or "" if none is present.
func tpmDevicePath() string {
	for _, dev := range []string{tpmResourceMgrDevice, tpmRawDevice} {
		if _, err := os.Stat(dev); err == nil {
			return dev
		}
	}
	return ""
}

// deriveTPMKey opens the TPM, obtains the sealed seed (creating and persisting it when create is true
// and none exists), and HKDFs it into the AES-256 key. create is false on the decrypt path: a missing
// sealed seed is then a hard error rather than silently minting a new, non-matching key.
func deriveTPMKey(create bool) ([]byte, error) {
	dev := tpmDevicePath()
	if dev == "" {
		return nil, fmt.Errorf("no TPM device present")
	}
	thetpm, err := linuxtpm.Open(dev)
	if err != nil {
		return nil, fmt.Errorf("open TPM %s: %w", dev, err)
	}
	defer thetpm.Close()

	// The storage root key is derived deterministically from the TPM's seed by the standard ECC
	// template, so the same SRK is reproduced every boot without persisting it.
	srk, err := tpm2.CreatePrimary{
		PrimaryHandle: tpm2.TPMRHOwner,
		InPublic:      tpm2.New2B(tpm2.ECCSRKTemplate),
	}.Execute(thetpm)
	if err != nil {
		return nil, fmt.Errorf("TPM CreatePrimary: %w", err)
	}
	defer func() { _, _ = (tpm2.FlushContext{FlushHandle: srk.ObjectHandle}).Execute(thetpm) }()

	seed, err := loadOrCreateSeed(thetpm, srk, create)
	if err != nil {
		return nil, err
	}

	key := make([]byte, aes256KeySize)
	r := hkdf.New(sha256.New, seed, []byte("fme-static-credentials-tpm-salt"), []byte("fme-static-credentials-aes256-key"))
	if _, err := io.ReadFull(r, key); err != nil {
		return nil, fmt.Errorf("HKDF expand: %w", err)
	}
	return key, nil
}

func tpmSeedPath() string {
	return filepath.Join(config.GetConfigDir(), credentialsDir, tpmSeedFileName)
}

// loadOrCreateSeed unseals the stored seed, or (when create) generates a new one, seals it, and
// persists the sealed blob atomically. The create flag deliberately selects read-only vs
// create-if-missing mode (it is honoured on encrypt, refused on decrypt), not accidental coupling.
//
//revive:disable:flag-parameter
func loadOrCreateSeed(thetpm transport.TPM, srk *tpm2.CreatePrimaryResponse, create bool) ([]byte, error) {
	path := tpmSeedPath()
	blob, err := os.ReadFile(path)
	if err == nil {
		return unsealSeed(thetpm, srk, blob)
	}
	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read sealed seed: %w", err)
	}
	if !create {
		return nil, fmt.Errorf("no sealed seed stored")
	}

	seed := make([]byte, tpmSeedSize)
	if _, err := io.ReadFull(rand.Reader, seed); err != nil {
		return nil, fmt.Errorf("generate seed: %w", err)
	}
	sealed, err := sealSeed(thetpm, srk, seed)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), dirPermissions); err != nil {
		return nil, fmt.Errorf("create credentials directory: %w", err)
	}
	if err := writeFileAtomic(path, sealed, filePermissions); err != nil {
		return nil, fmt.Errorf("persist sealed seed: %w", err)
	}
	return seed, nil
}

//revive:enable:flag-parameter

// srkAuth builds the (empty) password authorization for the no-auth storage root key.
func srkAuth(srk *tpm2.CreatePrimaryResponse) tpm2.AuthHandle {
	return tpm2.AuthHandle{Handle: srk.ObjectHandle, Name: srk.Name, Auth: tpm2.PasswordAuth(nil)}
}

// sealSeed seals seed as a keyed-hash object under the SRK and returns the persisted blob
// (length-prefixed marshalled public + private portions).
func sealSeed(thetpm transport.TPM, srk *tpm2.CreatePrimaryResponse, seed []byte) ([]byte, error) {
	rsp, err := tpm2.Create{
		ParentHandle: srkAuth(srk),
		InSensitive: tpm2.TPM2BSensitiveCreate{
			Sensitive: &tpm2.TPMSSensitiveCreate{
				Data: tpm2.NewTPMUSensitiveCreate(&tpm2.TPM2BSensitiveData{Buffer: seed}),
			},
		},
		InPublic: tpm2.New2B(tpm2.TPMTPublic{
			Type:    tpm2.TPMAlgKeyedHash,
			NameAlg: tpm2.TPMAlgSHA256,
			ObjectAttributes: tpm2.TPMAObject{
				FixedTPM:     true,
				FixedParent:  true,
				UserWithAuth: true,
				NoDA:         true,
			},
		}),
	}.Execute(thetpm)
	if err != nil {
		return nil, fmt.Errorf("TPM Create (seal): %w", err)
	}
	return encodeSealedBlob(tpm2.Marshal(rsp.OutPublic), tpm2.Marshal(rsp.OutPrivate)), nil
}

// unsealSeed loads the sealed object under the SRK and unseals it back to the plaintext seed.
func unsealSeed(thetpm transport.TPM, srk *tpm2.CreatePrimaryResponse, blob []byte) ([]byte, error) {
	pubBytes, privBytes, err := decodeSealedBlob(blob)
	if err != nil {
		return nil, err
	}
	pub, err := tpm2.Unmarshal[tpm2.TPM2BPublic](pubBytes)
	if err != nil {
		return nil, fmt.Errorf("unmarshal sealed public: %w", err)
	}
	priv, err := tpm2.Unmarshal[tpm2.TPM2BPrivate](privBytes)
	if err != nil {
		return nil, fmt.Errorf("unmarshal sealed private: %w", err)
	}

	loaded, err := tpm2.Load{
		ParentHandle: srkAuth(srk),
		InPrivate:    *priv,
		InPublic:     *pub,
	}.Execute(thetpm)
	if err != nil {
		return nil, fmt.Errorf("TPM Load: %w", err)
	}
	defer func() { _, _ = (tpm2.FlushContext{FlushHandle: loaded.ObjectHandle}).Execute(thetpm) }()

	unsealed, err := tpm2.Unseal{
		ItemHandle: tpm2.NamedHandle{Handle: loaded.ObjectHandle, Name: loaded.Name},
	}.Execute(thetpm)
	if err != nil {
		return nil, fmt.Errorf("TPM Unseal: %w", err)
	}
	return unsealed.OutData.Buffer, nil
}

// encodeSealedBlob frames the two marshalled TPM structures as [uint32 len||pub][uint32 len||priv].
func encodeSealedBlob(pub, priv []byte) []byte {
	out := make([]byte, 0, 8+len(pub)+len(priv))
	var n [4]byte
	binary.BigEndian.PutUint32(n[:], uint32(len(pub)))
	out = append(out, n[:]...)
	out = append(out, pub...)
	binary.BigEndian.PutUint32(n[:], uint32(len(priv)))
	out = append(out, n[:]...)
	out = append(out, priv...)
	return out
}

func decodeSealedBlob(blob []byte) (pub, priv []byte, err error) {
	if len(blob) < 4 {
		return nil, nil, fmt.Errorf("sealed seed blob truncated")
	}
	pubLen := binary.BigEndian.Uint32(blob[:4])
	rest := blob[4:]
	if uint32(len(rest)) < pubLen+4 {
		return nil, nil, fmt.Errorf("sealed seed blob truncated")
	}
	pub = rest[:pubLen]
	rest = rest[pubLen:]
	privLen := binary.BigEndian.Uint32(rest[:4])
	rest = rest[4:]
	if uint32(len(rest)) < privLen {
		return nil, nil, fmt.Errorf("sealed seed blob truncated")
	}
	priv = rest[:privLen]
	return pub, priv, nil
}
