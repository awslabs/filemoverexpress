package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/utils/crypto"
)

const (
	strCrypto        = "crypto"
	strCryptoHelp    = "Pre-shared key encryption and decryption utilities"
	strEncryptUse    = "encrypt"
	strEncryptHelp   = "Encrypt a value using a secret and AES-GCM"
	strDecryptUse    = "decrypt"
	strDecryptHelp   = "Decrypt a base64-encoded AES-GCM encrypted value"
	strEnterSecret   = "Enter secret: "
	strEnterValue    = "Enter value to encrypt: "
	strEnterEncValue = "Enter encrypted value: "
	strUpdateConfig  = "Update the PreSharedKey in your configuration file? (y/n): "
	strConfigUpdated = "Configuration updated successfully."
)

var (
	cryptoCmd = &cobra.Command{
		Use:   strCrypto,
		Short: strCryptoHelp,
		Long:  strCryptoHelp,
	}

	encryptCmd = &cobra.Command{
		Use:   strEncryptUse,
		Short: strEncryptHelp,
		Long:  strEncryptHelp,
		Args:  cobra.NoArgs,
		Run:   runEncrypt,
	}

	decryptCmd = &cobra.Command{
		Use:   strDecryptUse,
		Short: strDecryptHelp,
		Long:  strDecryptHelp,
		Args:  cobra.NoArgs,
		Run:   runDecrypt,
	}
)

func init() {
	cryptoCmd.AddCommand(encryptCmd)
	cryptoCmd.AddCommand(decryptCmd)
	rootCmd.AddCommand(cryptoCmd)
}

func runEncrypt(_ *cobra.Command, _ []string) {
	reader := bufio.NewReader(os.Stdin)

	secret := promptInput(reader, strEnterSecret)
	rawValue := promptInput(reader, strEnterValue)

	encrypted, err := crypto.EncryptPSK(secret, rawValue)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Encryption failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(encrypted)
	cfg := config.LoadConfiguration()

	answer := promptInput(reader, strUpdateConfig)
	if strings.EqualFold(strings.TrimSpace(answer), "y") {
		cfg.APIServer.RemoteSettings.PreSharedKey = encrypted

		if err := config.SaveConfig(&cfg); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write config: %v\n", err)
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, strConfigUpdated)
	}
}

func runDecrypt(_ *cobra.Command, _ []string) {
	reader := bufio.NewReader(os.Stdin)

	secret := promptInput(reader, strEnterSecret)
	encryptedValue := promptInput(reader, strEnterEncValue)

	decrypted, err := crypto.DecryptPSK(secret, encryptedValue)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Decryption failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(decrypted)
}

func promptInput(reader *bufio.Reader, prompt string) string {
	fmt.Fprint(os.Stderr, prompt)
	input, _ := reader.ReadString('\n')
	return strings.TrimSpace(input)
}
