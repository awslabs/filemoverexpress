package e2e

import (
    "fmt"
    "log"
    "os"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestDaemon_ExitsWhenBasePathNonExistent(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping e2e tests in short mode")
    }
    t.Skip() // skip test since expected functionality now is not exiting

    setUp()
    dir, err := os.Getwd()
    if err != nil {
        log.Fatal("unable to retrieve working directory")
    }

    env := []string{
        fmt.Sprintf("FME_CONFIG_DIR=%s/configs/invalidbasepath", dir),
    }

    out, err := executeCommandWithEnv(env, "daemon")
    if err != nil && err.Error() != "exit status 1" {
        log.Fatalf("Failed to upload file: %s", err.Error())
        return
    }

    assert.Contains(t, out, "Failed getting base path dir info for transfer profile e2e-test")
}
