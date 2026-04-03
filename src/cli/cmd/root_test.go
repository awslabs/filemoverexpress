package cmd

import (
    "bytes"
    "io"
    "os/user"
    "testing"

    "github.com/stretchr/testify/assert"
)

func TestRootCmd(t *testing.T) {
    expected := strRootLongHelp
    c := rootCmd
    b := bytes.NewBufferString("")
    c.SetArgs([]string{"--help"})
    c.SetOut(b)
    execErr := c.Execute()
    if execErr != nil {
        t.Fatal(execErr)
    }
    out, err := io.ReadAll(b)
    if err != nil {
        t.Fatal(err)
    }

    assert.Contains(t, string(out), expected)
}

// todo: update to be able to inject logger or use events to get data out of the function
func TestWarnIfRoot(t *testing.T) {
    usr := user.User{
        Uid:      "1",
        Gid:      "",
        Username: "",
        Name:     "",
        HomeDir:  "",
    }

    warnIfRoot(&usr)

    usr = user.User{
        Uid:      "0",
        Gid:      "",
        Username: "",
        Name:     "",
        HomeDir:  "",
    }

    warnIfRoot(&usr)
}

// todo: update to be able to inject logger or use events to get data out of the function
func TestWarnIfAdministrator(t *testing.T) {
    usr := user.User{
        Uid:      "",
        Gid:      "",
        Username: "Administrator",
        Name:     "",
        HomeDir:  "",
    }

    warnIfRoot(&usr)

    usr = user.User{
        Uid:      "",
        Gid:      "",
        Username: "Administrator",
        Name:     "",
        HomeDir:  "",
    }

    warnIfRoot(&usr)
}
