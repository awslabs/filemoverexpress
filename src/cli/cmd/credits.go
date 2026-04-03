package cmd

import (
    "fmt"

    "github.com/spf13/cobra"

    "github.com/awslabs/filemoverexpress/globals"
)

const (
    creditsUrl = "https://d28swwh2msbn6k.cloudfront.net/credits/%s/%s" //#nosec G101 -- False positive
)

var (
    creditsCmd = &cobra.Command{
        Use:   strCreditsUse,
        Short: strCreditsHelp,
        Long:  strCreditsHelp,
        Run:   showCredits,
        Args:  cobra.NoArgs,
    }
    creditLinks = map[string]string{
        "Electron":     "electron-licenses.txt",
        "Node Modules": "node-licenses.txt",
        "Chromium":     "LICENSES.chromium.html",
        "CLI":          "cli-licenses.txt",
        "GUI":          "gui-licenses.txt",
    }
)

func init() {
    rootCmd.AddCommand(creditsCmd)
}

func showCredits(_ *cobra.Command, _ []string) {
    version := globals.GetInstance().GetVersion()
    if version == "0.0.0-local-dev" {
        version = "testing"
    }

    fmt.Println(strCreditsExplanation)
    fmt.Println()
    for name, link := range creditLinks {
        url := fmt.Sprintf(creditsUrl, version, link)
        fmt.Printf("%-15s%s\n", name, url)
    }
}
