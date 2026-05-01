package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/inventory"
	"github.com/awslabs/filemoverexpress/types/inventorytypes"
	"github.com/awslabs/filemoverexpress/utils"
	"github.com/awslabs/filemoverexpress/utils/errs"
)

var (
	s3InventoryCmd = &cobra.Command{
		Use:   strS3InventoryUse,
		Short: strS3InventoryHelp,
		Long:  strS3InventoryHelp,
		Run:   run,
		Args:  s3InventoryCheckArgs,
	}
	outputFormat           string
	pretty                 bool
	checksum               bool
	allowedOutputFormats   = []string{"json", "yaml", "xml", "csv"}
	inventoryTxProfileName string
)

func init() {
	outputFormatHelp := fmt.Sprintf(strS3InventoryOutputFormat, strings.Join(allowedOutputFormats, ", "))
	pFlags := s3InventoryCmd.PersistentFlags()
	pFlags.StringVar(&outputFormat, "output-format", "json", outputFormatHelp)
	pFlags.BoolVar(&pretty, "pretty", false, strS3InventoryPrettyUsage)
	// TODO: Re-enable this when fixed
	// pFlags.BoolVar(&checksum, "include-checksum", false, strS3InventoryIncludeChecksumUsage)
	rootCmd.AddCommand(s3InventoryCmd)
}

func s3InventoryCheckArgs(cmd *cobra.Command, args []string) error {
	exitIfIncorrectArgCount(cmd, args)

	cfg := config.LoadConfiguration()

	var txProfiles []string
	for txProfile := range cfg.Protocols.S3.TransferProfiles {
		txProfiles = append(txProfiles, txProfile)
	}

	inventoryTxProfileName = args[0]
	if !utils.StringArrayContains(txProfiles, inventoryTxProfileName) {
		return fmt.Errorf(strInvalidTransferProfile, inventoryTxProfileName, strings.Join(txProfiles, ", "))
	}

	if !utils.StringArrayContains(allowedOutputFormats, strings.ToLower(outputFormat)) {
		return fmt.Errorf(
			strS3InventoryInvalidOutputFormat,
			outputFormat,
			strings.Join(allowedOutputFormats, ", "),
		)
	}

	return nil
}

func exitIfIncorrectArgCount(cmd *cobra.Command, args []string) {
	if len(args) != 1 {
		if err := cmd.Usage(); err != nil {
			errs.CheckError(err, strFailedPrintingHelp, true)
		}
		os.Exit(1)
	}
}

func run(_ *cobra.Command, _ []string) {
	txProfile, err := config.LoadConfiguration().GetTransferProfile(inventoryTxProfileName)
	errs.CheckError(err, "", true)

	inventoryInput := inventorytypes.GenerateInventoryInput{
		TransferProfile:  txProfile,
		OutputFormat:     outputFormat,
		Pretty:           pretty,
		IncludeChecksums: checksum,
	}

	err = inventory.GenerateInventory(inventoryInput)
	errs.CheckError(err, strFailedGeneratingInventory, true)
}
