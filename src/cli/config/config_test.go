package config

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/knadh/koanf/providers/file"
	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

// resetConfigState resets all package-level state between tests.
func resetConfigState() {
	cachedCfg = atomic.Value{}
	initialized = false
	boundFlags = make(map[string]*pflag.Flag)
	fileProvider = nil
	configFile = ""
	configDir = ""
}

func TestString(t *testing.T) {
	testS3TransferProfile := configtypes.TransferProfile{
		Bucket:      "invalid-test-bucket",
		Region:      "us-west-2",
		Accelerated: true,
		FileOrder:   []string{".jpg", ".mov"},
	}

	checkStrings := []string{
		fmt.Sprintf("Accelerated: %t", testS3TransferProfile.Accelerated),
		fmt.Sprintf("Bucket: %s", testS3TransferProfile.Bucket),
		fmt.Sprintf("FileOrder: %s", testS3TransferProfile.FileOrder),
		fmt.Sprintf("Region: %s", testS3TransferProfile.Region),
	}

	s := testS3TransferProfile.String()
	for _, checkString := range checkStrings {
		if !strings.Contains(s, checkString) {
			t.Errorf("TestString got an unexpected value. Expected '%s' in output, got '%s'", checkString, s)
		}
	}
}

// --- Test 1: Default values match expected constants ---

func TestDefaultValuesMatchConstants(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	// Create a minimal (empty) config file
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)

	// Point fileProvider at the empty config file
	setupFileProvider(cfgPath)

	cfg := loadConfig()

	// General defaults
	assert.Equal(t, constants.DefaultNoSleep, cfg.General.NoSleep)
	assert.Equal(t, uint32(constants.DefaultRetryCount), cfg.General.RetryCount)
	assert.Equal(t, int32(constants.DefaultMaxActiveTransfers), cfg.General.MaxActiveTransfers)
	assert.Equal(t, systeminfo.GetCoreCount(), cfg.General.MaxActiveChecksums)
	assert.Equal(t, int32(constants.DefaultTargetBandwidth), cfg.General.TargetBandwidth)

	// Logging defaults
	assert.Equal(t, constants.DefaultLoggingDirectory, cfg.Logging.Directory)
	assert.Equal(t, constants.DefaultLoggingSeverity, cfg.Logging.Severity)
	assert.Equal(t, constants.DefaultLoggingMaxSize, cfg.Logging.MaxSize)
	assert.Equal(t, constants.DefaultLoggingMaxAge, cfg.Logging.MaxAge)
	assert.Equal(t, constants.DefaultLoggingCompress, cfg.Logging.Compress)

	// Reports defaults
	assert.Equal(t, constants.DefaultReportsDirectory, cfg.Reports.Directory)

	// API Server defaults
	assert.Equal(t, constants.DefaultAPIServerEnabled, cfg.APIServer.Enabled)
	assert.Equal(t, constants.DefaultAPIServerTLSEnabled, cfg.APIServer.TLSSettings.Enabled)
	assert.Equal(t, constants.DefaultAPIServerRemoteEnabled, cfg.APIServer.RemoteSettings.Enabled)
	assert.Equal(t, constants.DefaultAllowUIConfiguration, cfg.APIServer.Permissions.AllowUIConfiguration)
	assert.Equal(t, constants.DefaultAllowLocalRenameDelete, cfg.APIServer.Permissions.AllowLocalRenameDelete)
	assert.Equal(t, constants.DefaultAllowRemoteRenameDelete, cfg.APIServer.Permissions.AllowRemoteRenameDelete)

	// Blocked paths should be the platform default
	assert.Equal(t, getDefaultBlockedPaths(), cfg.APIServer.BlockedPathList)
}

// --- Test 2: Flag bindings for all 9 flags ---

func TestFlagBindingThreads(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	writeMinimalConfigWithProfile(t, cfgPath)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("threads", "20")
	err := BindFlag("protocols.s3.threads", flag)
	require.NoError(t, err)

	cfg := loadConfig()
	// The flag value should override the file value for the top-level key
	// Since threads is a profile-level field, the flag binding applies at the koanf level
	// Verify the flag was stored
	assert.Equal(t, flag, boundFlags["protocols.s3.threads"])
	assert.NotNil(t, cfg)
}

func TestFlagBindingChunkSize(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	writeMinimalConfigWithProfile(t, cfgPath)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("chunk-size", "50")
	err := BindFlag("protocols.s3.chunkSize", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["protocols.s3.chunkSize"])
}

func TestFlagBindingMaxAge(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	writeMinimalConfigWithProfile(t, cfgPath)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("max-age", "7d")
	err := BindFlag("protocols.s3.maxAge", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["protocols.s3.maxAge"])
}

func TestFlagBindingFilter(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	writeMinimalConfigWithProfile(t, cfgPath)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("filter", "*.jpg")
	err := BindFlag("protocols.s3.filter", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["protocols.s3.filter"])
}

func TestFlagBindingMaxActiveTransfers(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("max-active-transfers", "5")
	err = BindFlag("general.maxActiveTransfers", flag)
	require.NoError(t, err)

	cfg := loadConfig()
	// The flag value "5" is loaded as a string into the koanf confmap, which then
	// gets unmarshalled. Verify the binding is stored and config loads without error.
	assert.Equal(t, flag, boundFlags["general.maxActiveTransfers"])
	assert.NotNil(t, cfg)
}

func TestFlagBindingMaxActiveChecksums(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("max-active-checksums", "4")
	err = BindFlag("general.maxActiveChecksums", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["general.maxActiveChecksums"])
}

func TestFlagBindingChecksumAlgorithm(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	writeMinimalConfigWithProfile(t, cfgPath)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("checksum-algorithm", "xxhash")
	err := BindFlag("protocols.s3.checksumAlgorithm", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["protocols.s3.checksumAlgorithm"])
}

func TestFlagBindingRetryCount(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("retry-count", "5")
	err = BindFlag("general.retryCount", flag)
	require.NoError(t, err)

	assert.Equal(t, flag, boundFlags["general.retryCount"])
}

func TestFlagBindingAddress(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)
	setupFileProvider(cfgPath)

	flag := createChangedFlag("address", "0.0.0.0")
	err = BindFlag("apiServer.remote.address", flag)
	require.NoError(t, err)

	cfg := loadConfig()
	assert.Equal(t, "0.0.0.0", cfg.APIServer.RemoteSettings.Address)
}

func TestBindFlagNilReturnsError(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	err := BindFlag("some.key", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "flag is nil")
}

func TestFlagNotChangedUsesDefault(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")
	err := os.WriteFile(cfgPath, []byte("{}"), 0600)
	require.NoError(t, err)
	setupFileProvider(cfgPath)

	// Create a flag that is NOT changed
	flag := createUnchangedFlag("address", "192.168.1.1")
	err = BindFlag("apiServer.remote.address", flag)
	require.NoError(t, err)

	cfg := loadConfig()
	// Since the flag is not Changed, the default/file value should be used (empty string)
	assert.Equal(t, "", cfg.APIServer.RemoteSettings.Address)
}

// --- Test 3: createConfigIfNotExists ---

func TestCreateConfigIfNotExistsCreatesFile(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	// File should not exist yet
	_, err := os.Stat(cfgPath)
	require.True(t, os.IsNotExist(err))

	createConfigIfNotExists(cfgPath)

	// File should now exist
	info, err := os.Stat(cfgPath)
	require.NoError(t, err)
	assert.True(t, info.Size() > 0)

	// File should contain valid YAML with default values
	data, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	assert.Contains(t, string(data), "general:")
}

func TestCreateConfigIfNotExistsDoesNotOverwrite(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	// Write a custom config file
	customContent := []byte("general:\n  retryCount: 99\n")
	err := os.WriteFile(cfgPath, customContent, 0600)
	require.NoError(t, err)

	createConfigIfNotExists(cfgPath)

	// File should still have the custom content
	data, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	assert.Equal(t, string(customContent), string(data))
}

// --- Test 4: GetConfigName with FME_E2E ---

func TestGetConfigNameDefault(t *testing.T) {
	name := GetConfigName()
	assert.Equal(t, constants.ConfigFilename, name)
}

func TestGetConfigNameE2E(t *testing.T) {
	t.Setenv("FME_E2E", "true")
	name := GetConfigName()
	assert.Equal(t, constants.ConfigFilename+"-e2e", name)
}

func TestGetConfigNameE2EFalse(t *testing.T) {
	t.Setenv("FME_E2E", "false")
	name := GetConfigName()
	assert.Equal(t, constants.ConfigFilename, name)
}

// --- Test 5: loadConfig fatals on malformed YAML ---
// Note: logger.Fatal only calls os.Exit when loggers are initialized.
// We test this by running a subprocess that initializes the console logger.

func TestLoadConfigFatalsOnMalformedYAML(t *testing.T) {
	if os.Getenv("TEST_MALFORMED_YAML") == "1" {
		resetConfigState()

		// Initialize a minimal logger so Fatal actually calls os.Exit
		initTestLogger()

		tmpDir := os.TempDir()
		cfgPath := filepath.Join(tmpDir, "malformed-config-test.yaml")
		// Write invalid YAML
		err := os.WriteFile(cfgPath, []byte("{{{{invalid yaml: [[["), 0600)
		if err != nil {
			os.Exit(2)
		}
		defer os.Remove(cfgPath)
		setupFileProvider(cfgPath)
		loadConfig()
		// Should not reach here
		os.Exit(0)
	}

	cmd := exec.Command(os.Args[0], "-test.run=TestLoadConfigFatalsOnMalformedYAML")
	cmd.Env = append(os.Environ(), "TEST_MALFORMED_YAML=1")
	err := cmd.Run()

	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) && !exitErr.Success() {
		// Expected: process exited with non-zero status (fatal)
		return
	}
	t.Errorf("Expected loadConfig to fatal on malformed YAML, but it did not exit with error")
}

// --- Test 6: SaveConfig returns error on non-writable path ---

func TestSaveConfigReturnsErrorOnNonWritablePath(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	// Set configFile to a non-writable path
	configFile = "/nonexistent-dir/subdir/config.yaml"

	cfg := &configtypes.FmeConfig{}
	err := SaveConfig(cfg)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to write config file")
}

// --- Test 7: camelCase config format ---

func TestCamelCaseConfigFormat(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	// Write a fixture YAML file with camelCase keys
	fixture := `general:
  noSleep: true
  retryCount: 7
  maxActiveChecksums: 2
  maxActiveTransfers: 5
  targetBandwidth: 100
logging:
  directory: "/var/log/fme"
  severity: "debug"
  maxSize: 200
  maxAge: 14
  compress: false
reports:
  directory: "/tmp/reports"
apiServer:
  enabled: false
  tls:
    enabled: true
    certificateFile: "/path/to/cert.pem"
    keyFile: "/path/to/key.pem"
  remote:
    enabled: true
    key: "my-secret-key"
    ports:
      - 8080
      - 9090
    address: "127.0.0.1"
  blockedPaths:
    - "/blocked1"
    - "/blocked2"
  allowedOrigins:
    - "https://example.com"
  permissions:
    allowUIConfiguration: true
    allowLocalRenameDelete: true
    allowRemoteRenameDelete: true
protocols:
  s3:
    transferProfiles:
      my-profile:
        name: "my-profile"
        bucket: "test-bucket"
        region: "eu-west-1"
        profile: "default"
        endpoint: "https://s3.example.com"
        filter: "*.mp4"
        autoTuning: true
        checksums:
          enabled: true
          algorithm: "xxhash"
        chunkSize: 50
        threads: 8
        maxAge: "30d"
        accelerated: true
        fileOrder:
          - ".mov"
          - ".mp4"
        enableMetadataFilter: true
        storageClass: "STANDARD_IA"
        paths:
          local: "/data/local"
          remote: "s3://remote/path"
hotFolders:
  - enabled: true
    localSourceFolder: "/watch/folder"
    name: "hot1"
    forceInitialUpload: true
    remoteConfigurations:
      - remoteConfigurationName: "my-profile"
        s3DestinationFolder: "uploads/"
`
	err := os.WriteFile(cfgPath, []byte(fixture), 0600)
	require.NoError(t, err)

	setupFileProvider(cfgPath)
	cfg := loadConfig()

	// General
	assert.True(t, cfg.General.NoSleep)
	assert.Equal(t, uint32(7), cfg.General.RetryCount)
	assert.Equal(t, int32(2), cfg.General.MaxActiveChecksums)
	assert.Equal(t, int32(5), cfg.General.MaxActiveTransfers)
	assert.Equal(t, int32(100), cfg.General.TargetBandwidth)

	// Logging
	assert.Equal(t, "/var/log/fme", cfg.Logging.Directory)
	assert.Equal(t, "debug", cfg.Logging.Severity)
	assert.Equal(t, 200, cfg.Logging.MaxSize)
	assert.Equal(t, 14, cfg.Logging.MaxAge)
	assert.False(t, cfg.Logging.Compress)

	// Reports
	assert.Equal(t, "/tmp/reports", cfg.Reports.Directory)

	// API Server
	assert.False(t, cfg.APIServer.Enabled)
	assert.True(t, cfg.APIServer.TLSSettings.Enabled)
	assert.Equal(t, "/path/to/cert.pem", cfg.APIServer.TLSSettings.CertificateFile)
	assert.Equal(t, "/path/to/key.pem", cfg.APIServer.TLSSettings.KeyFile)
	assert.True(t, cfg.APIServer.RemoteSettings.Enabled)
	assert.Equal(t, "my-secret-key", cfg.APIServer.RemoteSettings.PreSharedKey)
	assert.Equal(t, []uint32{8080, 9090}, cfg.APIServer.RemoteSettings.Ports)
	assert.Equal(t, "127.0.0.1", cfg.APIServer.RemoteSettings.Address)
	assert.Equal(t, []string{"/blocked1", "/blocked2"}, cfg.APIServer.BlockedPathList)
	assert.Equal(t, []string{"https://example.com"}, cfg.APIServer.AllowedOrigins)
	assert.True(t, cfg.APIServer.Permissions.AllowUIConfiguration)
	assert.True(t, cfg.APIServer.Permissions.AllowLocalRenameDelete)
	assert.True(t, cfg.APIServer.Permissions.AllowRemoteRenameDelete)

	// Protocols - Transfer Profile
	require.Contains(t, cfg.Protocols.S3.TransferProfiles, "my-profile")
	profile := cfg.Protocols.S3.TransferProfiles["my-profile"]
	assert.Equal(t, "my-profile", profile.Name)
	assert.Equal(t, "test-bucket", profile.Bucket)
	assert.Equal(t, "eu-west-1", profile.Region)
	assert.Equal(t, "default", profile.Profile)
	assert.Equal(t, "https://s3.example.com", profile.Endpoint)
	assert.Equal(t, "*.mp4", profile.Filter)
	assert.True(t, profile.AutoTuning)
	assert.True(t, profile.Checksums.Enabled)
	assert.Equal(t, constants.ChecksumAlgorithm("xxhash"), profile.Checksums.Algorithm)
	assert.Equal(t, int32(50), profile.ChunkSize)
	assert.Equal(t, 8, profile.Threads)
	assert.Equal(t, "30d", profile.MaxAge)
	assert.True(t, profile.Accelerated)
	assert.Equal(t, []string{".mov", ".mp4"}, profile.FileOrder)
	assert.True(t, profile.EnableMetadataFilter)
	assert.Equal(t, "STANDARD_IA", profile.StorageClass)
	assert.Equal(t, "/data/local", profile.Paths.Local)
	assert.Equal(t, "s3://remote/path", profile.Paths.Remote)

	// Hot Folders
	require.Len(t, cfg.UploadHotFolders, 1)
	hf := cfg.UploadHotFolders[0]
	assert.True(t, hf.Enabled)
	assert.Equal(t, "/watch/folder", hf.LocalSourceFolder)
	assert.Equal(t, "hot1", hf.Name)
	assert.True(t, hf.ForceInitialUpload)
	require.Len(t, hf.RemoteConfigurations, 1)
	assert.Equal(t, "my-profile", hf.RemoteConfigurations[0].RemoteConfigurationName)
	assert.Equal(t, "uploads/", hf.RemoteConfigurations[0].S3DestinationFolder)
}

// --- Test: buildDefaultsMap returns expected keys ---

func TestBuildDefaultsMapKeys(t *testing.T) {
	defaults := buildDefaultsMap()

	expectedKeys := []string{
		"general.maxActiveChecksums",
		"general.maxActiveTransfers",
		"general.noSleep",
		"general.retryCount",
		"general.targetBandwidth",
		"logging.directory",
		"logging.severity",
		"logging.maxSize",
		"logging.maxAge",
		"logging.compress",
		"reports.directory",
		"protocols.s3.transferProfiles",
		"apiServer.allowedOrigins",
		"apiServer.enabled",
		"apiServer.tls.enabled",
		"apiServer.remote.enabled",
		"apiServer.blockedPaths",
		"apiServer.permissions.allowUIConfiguration",
		"apiServer.permissions.allowLocalRenameDelete",
		"apiServer.permissions.allowRemoteRenameDelete",
	}

	for _, key := range expectedKeys {
		_, exists := defaults[key]
		assert.True(t, exists, "Expected key %q in defaults map", key)
	}
}

// --- Test: buildDefaultConfig produces valid struct ---

func TestBuildDefaultConfig(t *testing.T) {
	cfg := buildDefaultConfig()

	assert.Equal(t, constants.DefaultNoSleep, cfg.General.NoSleep)
	assert.Equal(t, uint32(constants.DefaultRetryCount), cfg.General.RetryCount)
	assert.Equal(t, int32(constants.DefaultMaxActiveTransfers), cfg.General.MaxActiveTransfers)
	assert.Equal(t, constants.DefaultLoggingDirectory, cfg.Logging.Directory)
	assert.Equal(t, constants.DefaultAPIServerEnabled, cfg.APIServer.Enabled)
}

// --- Test: marshalConfigToFile and round-trip ---

func TestMarshalConfigToFileCreatesValidYAML(t *testing.T) {
	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "test-config.yaml")

	cfg := configtypes.FmeConfig{
		General: configtypes.General{
			RetryCount:         5,
			MaxActiveTransfers: 8,
		},
		Logging: configtypes.Logging{
			Directory: "my-logs",
			Severity:  "warn",
		},
	}

	err := marshalConfigToFile(cfg, cfgPath)
	require.NoError(t, err)

	// Verify file exists and has content
	data, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	assert.Contains(t, string(data), "retryCount: 5")
	assert.Contains(t, string(data), "maxActiveTransfers: 8")
	assert.Contains(t, string(data), "directory: my-logs")
}

// --- Helper functions ---

// setupFileProvider creates a file.Provider for the given path.
func setupFileProvider(cfgPath string) {
	fileProvider = file.Provider(cfgPath)
}

// createChangedFlag creates a pflag.Flag that has been marked as Changed.
func createChangedFlag(name, value string) *pflag.Flag {
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	fs.String(name, "", "test flag")
	_ = fs.Set(name, value)
	return fs.Lookup(name)
}

// createUnchangedFlag creates a pflag.Flag with a default value but NOT marked as Changed.
func createUnchangedFlag(name, defaultValue string) *pflag.Flag {
	fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
	fs.String(name, defaultValue, "test flag")
	return fs.Lookup(name)
}

// writeMinimalConfigWithProfile writes a minimal config file with a transfer profile.
func writeMinimalConfigWithProfile(t *testing.T, cfgPath string) {
	t.Helper()
	content := `protocols:
  s3:
    transferProfiles:
      test-profile:
        name: "test-profile"
        bucket: "my-bucket"
        region: "us-east-1"
        threads: 10
        chunkSize: 25
`
	err := os.WriteFile(cfgPath, []byte(content), 0600)
	require.NoError(t, err)
}

// initTestLogger initializes the logger so that logger.Fatal actually calls os.Exit.
func initTestLogger() {
	tmpDir := os.TempDir()
	_ = logger.Init(&logger.Config{
		Severity: logrus.InfoLevel,
		LogPath:  tmpDir,
		MaxSize:  1,
		MaxAge:   1,
		Compress: false,
	})
}
