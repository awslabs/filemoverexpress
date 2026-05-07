package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"

	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

func TestMakeConfigDir(t *testing.T) {
	tmpDir := t.TempDir()
	target := filepath.Join(tmpDir, "makeconfigdirtest")
	info := makeConfigDir(target)
	assert.Equal(t, "makeconfigdirtest", info.Name())
	assert.True(t, info.IsDir())
}

// TestCreateConfigIfNotExistsCreatesValidYAML verifies that the config file
// created by createConfigIfNotExists contains valid YAML that can be parsed
// back into an FmeConfig struct with the expected default structure.
func TestCreateConfigIfNotExistsCreatesValidYAML(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	createConfigIfNotExists(cfgPath)

	// Read the file back
	data, err := os.ReadFile(cfgPath)
	require.NoError(t, err)
	require.NotEmpty(t, data)

	// Parse as YAML into FmeConfig
	var parsed configtypes.FmeConfig
	err = yaml.Unmarshal(data, &parsed)
	require.NoError(t, err, "Created config file should contain valid YAML")

	// Verify it contains expected default values
	assert.Equal(t, uint32(constants.DefaultRetryCount), parsed.General.RetryCount)
	assert.Equal(t, int32(constants.DefaultMaxActiveTransfers), parsed.General.MaxActiveTransfers)
	assert.Equal(t, constants.DefaultNoSleep, parsed.General.NoSleep)
	assert.Equal(t, constants.DefaultLoggingDirectory, parsed.Logging.Directory)
	assert.Equal(t, constants.DefaultLoggingSeverity, parsed.Logging.Severity)
	assert.Equal(t, constants.DefaultLoggingCompress, parsed.Logging.Compress)
	assert.Equal(t, constants.DefaultReportsDirectory, parsed.Reports.Directory)
	assert.Equal(t, constants.DefaultAPIServerEnabled, parsed.APIServer.Enabled)
	assert.Equal(t, constants.DefaultAPIServerTLSEnabled, parsed.APIServer.TLSSettings.Enabled)
	assert.Equal(t, constants.DefaultAPIServerRemoteEnabled, parsed.APIServer.RemoteSettings.Enabled)
}

// TestCreateConfigIfNotExistsPreservesExisting verifies that calling
// createConfigIfNotExists when a file already exists does NOT overwrite
// the existing content.
func TestCreateConfigIfNotExistsPreservesExisting(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	// Write a custom config with non-default values
	customCfg := configtypes.FmeConfig{
		General: configtypes.General{
			RetryCount:         99,
			MaxActiveTransfers: 42,
			NoSleep:            true,
		},
		Logging: configtypes.Logging{
			Directory: "custom-logs",
			Severity:  "error",
		},
	}
	customData, err := yaml.Marshal(customCfg)
	require.NoError(t, err)
	err = os.WriteFile(cfgPath, customData, 0600)
	require.NoError(t, err)

	// Call createConfigIfNotExists — should NOT overwrite
	createConfigIfNotExists(cfgPath)

	// Read back and verify custom content is preserved
	data, err := os.ReadFile(cfgPath)
	require.NoError(t, err)

	var preserved configtypes.FmeConfig
	err = yaml.Unmarshal(data, &preserved)
	require.NoError(t, err)

	assert.Equal(t, uint32(99), preserved.General.RetryCount)
	assert.Equal(t, int32(42), preserved.General.MaxActiveTransfers)
	assert.True(t, preserved.General.NoSleep)
	assert.Equal(t, "custom-logs", preserved.Logging.Directory)
	assert.Equal(t, "error", preserved.Logging.Severity)
}

// TestSetupConfigFileAndDirectory verifies that setupConfigFileAndDirectory
// creates the config directory and returns the correct file and directory paths.
func TestSetupConfigFileAndDirectory(t *testing.T) {
	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	configSubDir := filepath.Join(tmpDir, "fme-config")
	t.Setenv("FME_CONFIG_DIR", configSubDir)

	cfgFile, cfgDir := setupConfigFileAndDirectory()

	// Directory should have been created
	info, err := os.Stat(configSubDir)
	require.NoError(t, err)
	assert.True(t, info.IsDir())

	// Returned configDir should match the env var
	assert.Equal(t, configSubDir, cfgDir)

	// Returned configFile should be the full path with correct name and extension
	expectedFile := filepath.Join(configSubDir, constants.ConfigFilename+"."+constants.ConfigFileExt)
	assert.Equal(t, expectedFile, cfgFile)
}

// TestCreateConfigIfNotExistsFilePermissions verifies that the created config
// file has restrictive permissions (0600) on Unix systems.
func TestCreateConfigIfNotExistsFilePermissions(t *testing.T) {
	if os.PathSeparator == '\\' {
		t.Skip("Skipping permission test on Windows (no Unix-style permissions)")
	}

	resetConfigState()
	defer resetConfigState()

	tmpDir := t.TempDir()
	cfgPath := filepath.Join(tmpDir, "configuration.yaml")

	createConfigIfNotExists(cfgPath)

	info, err := os.Stat(cfgPath)
	require.NoError(t, err)

	// File should have 0600 permissions (owner read/write only)
	perm := info.Mode().Perm()
	assert.Equal(t, os.FileMode(0600), perm, "Config file should have 0600 permissions")
}
