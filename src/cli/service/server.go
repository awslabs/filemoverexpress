package service

import (
    "errors"
    "fmt"
    "net"
    "os"
    "strconv"
    "strings"
    "sync"

    "github.com/awslabs/filemoverexpress/events"
    "github.com/awslabs/filemoverexpress/globals"
    "github.com/awslabs/filemoverexpress/logger"
    "github.com/awslabs/filemoverexpress/service/types"
    "github.com/awslabs/filemoverexpress/utils/crypto"
    "github.com/awslabs/filemoverexpress/utils/fs"
)

const (
    GrpcDefaultHost          = "127.0.0.1"
    GrpcDefaultWebPort       = 50006
    GrpcDefaultRemoteAddress = "0.0.0.0"
    fmePSKSecretEnvVar       = "FME_PSK_SECRET"
)

var (
    fmeServer  *FileMoverServer
    mtx        = sync.Mutex{}
    svcRunning = false
)

func NewService(grpcHost string, grpcWebPortList []uint, remote bool) *FileMoverServer {
    var (
        decryptErr error
        psk        string
    )

    mtx.Lock()
    if svcRunning {
        return fmeServer
    }
    defer mtx.Unlock()
    cfg := globals.GetInstance().GetCfg()
    if !cfg.APIServer.Enabled {
        events.Events.Warn(strApiServerDisabled)
        return nil
    }

    logger.Info(
        strRemoteDaemonStart,
        strings.Join(getIPv4Addresses(grpcHost), ", "),
        strings.Join(uintToStringSlice(grpcWebPortList), ", "),
    )

    if cfg.APIServer.RemoteSettings.PreSharedKey != "" {
        pskSecret, found := os.LookupEnv(fmePSKSecretEnvVar)
        if !found {
            events.Events.Fatal(strPSKEnvVarNotSet, fmePSKSecretEnvVar)
        }

        psk, decryptErr = crypto.DecryptPSK(pskSecret, cfg.APIServer.RemoteSettings.PreSharedKey)
        if decryptErr != nil {
            events.Events.Fatal(strPSKDecryptFailed, decryptErr.Error())
        }
    }

    fmeServer = startApi(types.ServiceConfig{
        Host:         grpcHost,
        Ports:        grpcWebPortList,
        Remote:       remote,
        PreSharedKey: psk,
    })
    svcRunning = true

    return fmeServer
}

func getIPv4Addresses(address string) []string {
    var ipAddrs []string
    var err error
    if address == GrpcDefaultRemoteAddress {
        ipAddrs, err = localAddressesIPv4()
        if err != nil {
            logger.Fatal("Error obtaining local addresses")
        }
    } else {
        ipAddrs = append(ipAddrs, address)
    }
    return ipAddrs
}

//revive:disable:cognitive-complexity,cyclomatic Flows better as one function instead of chain
func localAddressesIPv4() ([]string, error) {
    var ips []string
    ifaces, err := net.Interfaces()
    if err != nil {
        return ips, err
    }

    for _, iface := range ifaces {
        if iface.Flags&net.FlagUp == 0 {
            logger.Debug("Skipping interface %s, as it is not up\n", iface.Name)
            continue
        }
        if addrs, err := iface.Addrs(); err == nil {
            var ip net.IP
            for _, addr := range addrs {
                if ip = addr.(*net.IPNet).IP.To4(); ip != nil {
                    ips = append(ips, ip.String())
                }
            }
        }
    }
    return ips, nil
}

func uintToStringSlice(list []uint) []string {
    var ret []string
    const base10 = 10
    for i := range list {
        ret = append(ret, strconv.FormatUint(uint64(list[i]), base10))
    }
    return ret
}

// validateTLSSettings checks that cert and key file paths are non-empty and exist on disk.
// Certificate validity (expiry, chain, hostname verification) is handled by Go's crypto/tls
// package when the TLS connection is established.
func validateTLSSettings(cert string, key string) error {
    if strings.TrimSpace(cert) == "" || strings.TrimSpace(key) == "" {
        return errors.New(strCertOrKeyMissing)
    }

    if !fs.FileExists(cert) {
        return fmt.Errorf(strCertFileOpenFailed, cert)
    }

    if !fs.FileExists(key) {
        return fmt.Errorf(strKeyFileOpenFailed, key)
    }

    return nil
}
