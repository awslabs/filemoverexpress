package cmd

import (
    "fmt"
    "strings"
    "testing"
    "time"

    "github.com/spf13/cobra"
    "github.com/stretchr/testify/assert"
)

func TestCheckArguments_ErrorsWhenInvalidTransferProfile(t *testing.T) {
    var cmd = &cobra.Command{
        Use:   "test",
        Short: "test a thing",
    }

    txpName := fmt.Sprintf("test-profile-%d", time.Now().UnixMilli())
    args := []string{txpName}
    err := s3InventoryCheckArgs(cmd, args)
    expected := fmt.Sprintf("invalid transfer profile %s. valid transfer profiles:", txpName)
    if err != nil {
        assert.Contains(t, strings.ToLower(err.Error()), expected)
    } else {
        t.Error("Expected error, none thrown")
    }
}
