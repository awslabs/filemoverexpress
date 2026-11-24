//go:build e2e

package e2e

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Transfer profile names defined in every daemon config the suite writes.
const (
	profileDefault       = "default"       // md5 checksums, 5 MiB parts
	profileNoChecksum    = "nochecksum"    // checksums off
	profileXXH3          = "xxh3"          // xxh3 checksums
	profileMissingBucket = "missingbucket" // points at a bucket that does not exist
)

// Checksums are stored on the object as user metadata under the algorithm's name.
const (
	metaMD5  = "md5-hex"
	metaXXH3 = "xxh3"
)

const missingBucket = "e2e-bucket-that-does-not-exist"

const (
	// envGUIPort is the port the desktop app's web build listens on in the GUI layer. The daemon
	// only accepts requests from pages served from that origin.
	envGUIPort     = "E2E_GUI_PORT"
	defaultGUIPort = 8080
)

func guiPort() int {
	if v, err := strconv.Atoi(os.Getenv(envGUIPort)); err == nil && v > 0 {
		return v
	}
	return defaultGUIPort
}

// daemonConfig describes the daemon configuration file for a suite run.
type daemonConfig struct {
	Bucket   string
	Endpoint string
	Region   string
}

type profileSpec struct {
	name      string
	bucket    string
	algorithm string
	enabled   bool
}

func (c daemonConfig) profiles() []profileSpec {
	return []profileSpec{
		{profileDefault, c.Bucket, "md5-hex", true},
		{profileNoChecksum, c.Bucket, "none", false},
		{profileXXH3, c.Bucket, "xxh3", true},
		{profileMissingBucket, missingBucket, "md5-hex", true},
	}
}

// yaml renders the configuration. The keys are the daemon's own camelCase names.
//
// maxConnectionsPerHost and sendBufferBytes are 0 on purpose: with either set, the daemon builds
// its own HTTP client, which ignores the emulator's CA bundle (see the plan, section 9A).
func (c daemonConfig) yaml() string {
	var b strings.Builder
	fmt.Fprintf(&b, `general:
    noSleep: false
    retryCount: 1
    maxActiveChecksums: 4
    maxActiveTransfers: 4
    maxConnectionsPerHost: 0
    sendBufferBytes: 0
logging:
    directory: logs
    severity: debug
    maxSize: 10
    maxAge: 1
    compress: false
reports:
    directory: reports
apiServer:
    enabled: true
    tls:
        enabled: false
    remote:
        enabled: false
    blockedPaths: []
    allowedOrigins:
        - http://127.0.0.1:%[1]d
        - http://localhost:%[1]d
protocols:
    s3:
        transferProfiles:
`, guiPort())
	for _, p := range c.profiles() {
		fmt.Fprintf(&b, `            %[1]s:
                name: %[1]s
                bucket: %[2]s
                region: %[3]s
                profile: default
                endpoint: %[4]s
                autoTuning: false
                checksums:
                    enabled: %[5]t
                    algorithm: %[6]s
                chunkSize: 5
                threads: 4
                storageClass: standard
`, p.name, p.bucket, c.Region, c.Endpoint, p.enabled, p.algorithm)
	}
	b.WriteString("hotFolders: []\n")
	return b.String()
}
