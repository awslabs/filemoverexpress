package cmd

import (
    "context"
    "fmt"
    "os"
    "os/user"
    "runtime"

    "github.com/spf13/cobra"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/logger"
)

const (
    MinArgs = 1
)

var (
    rootCtx = context.Background()
    rootCmd = &cobra.Command{
        Use:   fmt.Sprintf(strRootUse, constants.ProductCLIName),
        Short: strRootShortHelp,
        Long:  strRootLongHelp,
        Args:  argsCheck,
        Run:   func(_ *cobra.Command, _ []string) {},
        ValidArgs: []string{
            strCompletion,
            strCreditsUse,
            strCrypto,
            strDaemon,
            strDownload,
            strHelp,
            strInventory,
            strSupportFileUse,
            strUpload,
            strValidateTransferProfile,
        },
    }
)

func Execute(version string) {
    rootCmd.Version = version
    globals.GetInstance().SetVersion(version)
    checkUser()

    if err := rootCmd.ExecuteContext(rootCtx); err != nil {
        logger.Fatal(err.Error())
    }
}

func checkUser() {
    userInfo, err := user.Current()
    if err != nil {
        logger.Warn(strRootFailedGettingUserInfo, err)
        return
    }
    switch runtime.GOOS {
    case "darwin":
    case "linux":
        warnIfRoot(userInfo)
    case "windows":
        warnIfAdministrator(userInfo)
    }
}

func warnIfRoot(userInfo *user.User) {
    if userInfo.Uid == "0" {
        logger.Warn(strRootRunningAsRoot)
    }
}

func warnIfAdministrator(userInfo *user.User) {
    if userInfo.Username == "Administrator" {
        logger.Warn(strRootRunningAsAdministrator)
    }
}

func argsCheck(cmd *cobra.Command, args []string) error {
    if len(args) < MinArgs {
        if err := cmd.Usage(); err != nil {
            events.Events.Error(strFailedPrintingHelp)
        }
        os.Exit(1)
    } else if !isValidArg(args[0], cmd.ValidArgs) {
        events.Events.Error(strInvalidArg, args[0])

        if err := cmd.Usage(); err != nil {
            events.Events.Error(strFailedPrintingHelp)
        }
        os.Exit(1)
    }

    return nil
}

func isValidArg(s string, args []string) bool {
    for _, arg := range args {
        if s == arg {
            return true
        }
    }
    return false
}
