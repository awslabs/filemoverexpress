package cmd

import (
    "os"
    "path/filepath"
    "runtime"
    "strconv"
    "strings"
    "syscall"

    "github.com/bunjiboys/daemon"
    "github.com/spf13/cobra"

    "github.com/awslabs/filemoverexpress/config"
    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/core/transferstats"
    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/service"
    "github.com/awslabs/filemoverexpress/types/daemontypes"
    "github.com/awslabs/filemoverexpress/utils"
    "github.com/awslabs/filemoverexpress/utils/fs"
)

const minRecommendedKeyLen = 8

var (
    ports         []uint
    address       string
    remoteEnabled bool
    daemonCmd     = &cobra.Command{
        Use:   strDaemon,
        Short: strDaemonHelp,
        Long:  strDaemonHelp,
        Args:  cobra.NoArgs,
        Run:   runDaemon,
    }
)

func init() {
    setDaemonFlags(daemonCmd)
    rootCmd.AddCommand(daemonCmd)
}

func setDaemonFlags(daemonCommand *cobra.Command) {
    pFlags := daemonCommand.PersistentFlags()
    pFlags.UintSliceVar(&ports, "ports", []uint{service.GrpcDefaultWebPort}, strRemotePortList)
    pFlags.StringVar(&address, "address", service.GrpcDefaultRemoteAddress, strRemoteAddress)
    pFlags.BoolVar(&remoteEnabled, "remote", false, strRemoteEnabled)
}

//revive:disable:function-length,cognitive-complexity
//nolint:nestif
func runDaemon(cmd *cobra.Command, _ []string) {
    isDaemonRunning, pid := checkPidFile()
    if isDaemonRunning {
        events.Events.Fatal(strDaemonAlreadyRunning, pid)
    }
    createPidFile()

    cfg := globals.GetInstance().GetCfg()
    createDaemon()
    if cfg.General.NoSleep {
        utils.RunCaffeinate()
    }

    global := globals.GetInstance()
    global.SetDaemonMode(true)
    hasValidTransferProfiles(global)
    checkPSKRecommendation()
    checkRemoteFlagUsage(cmd)
    transferstats.Initialize()

    addressFlagUsed := cmd.Flags().Lookup("address").Changed
    portsFlagUsed := cmd.Flags().Lookup("ports").Changed

    if remoteEnabled || cfg.APIServer.RemoteSettings.Enabled {
        if strings.TrimSpace(globals.GetInstance().GetCfg().APIServer.RemoteSettings.PreSharedKey) == "" {
            events.Events.Fatal(strRemoteWithoutKey)
        }
        if !cfg.APIServer.TLSSettings.Enabled {
            events.Events.Fatal(strRemoteTLSRequired)
        }
        if !addressFlagUsed && cfg.APIServer.RemoteSettings.Address != "" {
            address = cfg.APIServer.RemoteSettings.Address
        }
        if !portsFlagUsed && cfg.APIServer.RemoteSettings.Ports != nil {
            ports = []uint{}
            // UintSliceVar requires type uint,but Ports from cfg is uint64 as protobuf requires uint32/uint64, so a cast is needed
            for _, port := range cfg.APIServer.RemoteSettings.Ports {
                ports = append(ports, uint(port))
            }
        }
        go service.NewService(address, ports, true)
    } else {
        go service.NewService(service.GrpcDefaultHost, []uint{service.GrpcDefaultWebPort}, false)
    }
    daemontypes.DaemonWorker()
}

//revive:enable:function-length,cognitive-complexity

func hasValidTransferProfiles(global *globals.FmeGlobals) {
    if (len(global.GetCfg().Protocols.S3.TransferProfiles)) == 0 {
        logger.Warn(strDaemonNoTransferProfile)
    }
}

// checkPSKRecommendation will warn the user if the key in their configuration file is less than 8 characters long
func checkPSKRecommendation() {
    cfg := globals.GetInstance().GetCfg()
    if cfg.APIServer.RemoteSettings.Enabled || remoteEnabled {
        if len(cfg.APIServer.RemoteSettings.PreSharedKey) < minRecommendedKeyLen {
            logger.Warn(strWeakPSK)
        }
    }
}

// checkRemoteFlagUsage will warn the user if they use the --address flag or --ports flag without using the --remote flag or having
// api_server.remote.enabled set to true in their configuration file
func checkRemoteFlagUsage(cmd *cobra.Command) {
    if !remoteEnabled && !globals.GetInstance().GetCfg().APIServer.RemoteSettings.Enabled {
        if cmd.Flags().Lookup("address").Changed {
            logger.Warn(strRemoteIncorrectAddressUse, address)
        }
        if cmd.Flags().Lookup("ports").Changed {
            logger.Warn(strRemoteIncorrectPortsUse)
        }
    }
}

func createDaemon() daemon.Daemon {
    daemonType := getDaemonType()
    svc, err := daemon.New(constants.ProductName, strDaemonDescription, daemonType)
    if err != nil {
        logger.Fatal(strDaemonFailedInitializingDaemon, err)
    }

    return svc
}

func getDaemonType() daemon.Kind {
    var daemonType daemon.Kind
    switch runtime.GOOS {
    case "darwin":
        daemonType = daemon.GlobalDaemon
    case "windows", "linux":
        daemonType = daemon.SystemDaemon
    default:
        logger.Fatal(strDaemonUnsupportedOS, runtime.GOOS)
    }
    return daemonType
}

func createPidFile() {
    configDir := config.GetConfigDir()
    err := os.WriteFile(filepath.Join(configDir, constants.ProductCLIName+".pid"), []byte(strconv.Itoa(os.Getpid())), 0600)
    if err != nil {
        logger.Warn("Failed to initialize the pid file")
    }
}

func checkPidFile() (bool, int) {
    pidFilePath := filepath.Join(config.GetConfigDir(), constants.ProductCLIName+".pid")
    if fs.FileExists(pidFilePath) {
        f, readErr := os.ReadFile(pidFilePath)
        if readErr != nil {
            logger.SendLog("Warn", "Invalid pid file")
        }
        pid, err := strconv.Atoi(string(f))
        if err != nil {
            logger.SendLog("Warn", "Invalid pid file")
        }

        process, err := os.FindProcess(pid)
        if err != nil {
            return false, -1
        }

        err = process.Signal(syscall.Signal(0))
        if err == nil {
            return true, process.Pid
        }
    }

    return false, -1
}
