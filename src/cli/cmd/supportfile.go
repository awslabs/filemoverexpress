package cmd

import (
	"github.com/spf13/cobra"

	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/utils/supportfile"
)

var supportFileCmd = &cobra.Command{
	Use:   strSupportFileUse,
	Short: strSupportFileHelp,
	Long:  strSupportFileHelp,
	Args:  cobra.NoArgs,
	Run: func(_ *cobra.Command, _ []string) {
		_, _, err := supportfile.Create()
		if err != nil {
			logger.Fatal(err.Error())
		}
	},
}

func init() {
	rootCmd.AddCommand(supportFileCmd)
}
