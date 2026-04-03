package cmd

import (
    "fmt"
    "strings"
    "testing"
    "time"

    "github.com/spf13/cobra"
    "github.com/stretchr/testify/assert"
)

func TestForceFlag(t *testing.T) {
    var forceCmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }
    forceCmd.Flags().BoolVar(&force, "force", false, strS3ForceUsage)
    err := forceCmd.Flags().Set("force", "true")
    if err != nil {
        t.Error("TestForceFlag failed to set flag")
    }
    flag := getForceFlag(forceCmd)
    assert.Equal(t, flag, true)

    err = forceCmd.Flags().Set("force", "false")
    if err != nil {
        t.Errorf("TestForceFlag failed to set flag: %s", err.Error())
    }
    flag = getForceFlag(forceCmd)
    assert.Equal(t, flag, false)
}

func TestValidateCredentials(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }

    args := []string{"test"}
    validateCredentials(cmd, args)
}

func TestUploadArgsCheck_ErrorsWhenTransferProfileInvalid(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }

    txpName := fmt.Sprintf("test-profile-%d", time.Now().UnixMilli())
    args := []string{txpName, "test2"}
    err := uploadArgsCheck(cmd, args)
    expected := fmt.Sprintf("invalid transfer profile %s. valid transfer profiles:", txpName)
    if err != nil {
        assert.Contains(t, strings.ToLower(err.Error()), expected)
    } else {
        t.Error("Expected error, none thrown")
    }
}

func TestExitIfMinArgs_AllowsTwoArgs(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }
    args := []string{"blah", "asdf"}
    exitIfMinArgs(cmd, args, MinUploadArgs)
}

func TestExitIfMinArgs_AllowsThreeArgs(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }
    args := []string{"blah", "asdf", "lakjsdjhkj"}
    exitIfMinArgs(cmd, args, MinDownloadArgs)
}

func TestDownloadArgsCheck_ErrorsWhenTransferProfileInvalid(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }

    txpName := fmt.Sprintf("test-profile-%d", time.Now().UnixMilli())
    args := []string{txpName, "test2", "test3"}
    err := downloadArgsCheck(cmd, args)
    expected := fmt.Sprintf("invalid transfer profile %s. valid transfer profiles:", txpName)
    t.Log("Expected error, none thrown")
    assert.NotNil(t, err)
    if err != nil {
        assert.Contains(t, strings.ToLower(err.Error()), expected)
    } else {
        t.Error("Expected error, none thrown")
    }
}
