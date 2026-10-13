package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func readGUIConfigRaw(t *testing.T, dir string) map[string]json.RawMessage {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(dir, guiConfigFileName))
	require.NoError(t, err)
	var m map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(data, &m))
	return m
}

func TestGUIConfigLoadWindowMissingFile(t *testing.T) {
	cfg := NewGUIConfig(t.TempDir())
	_, ok := cfg.LoadWindow()
	assert.False(t, ok)
}

func TestGUIConfigLoadWindowMalformed(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, guiConfigFileName), []byte("{nope"), 0o600))
	cfg := NewGUIConfig(dir)
	_, ok := cfg.LoadWindow()
	assert.False(t, ok)
}

func TestGUIConfigLoadWindowAbsentSection(t *testing.T) {
	dir := t.TempDir()
	// Valid file, but no window section.
	require.NoError(t, os.WriteFile(filepath.Join(dir, guiConfigFileName), []byte(`{"version":1}`), 0o600))
	cfg := NewGUIConfig(dir)
	_, ok := cfg.LoadWindow()
	assert.False(t, ok)
}

func TestGUIConfigSaveAndLoadWindowRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	st := persistedWindowState{Version: windowStateVersion, X: 10, Y: 20, Width: 1280, Height: 800, Maximised: true}

	cfg.SaveWindow(st)

	got, ok := cfg.LoadWindow()
	require.True(t, ok)
	assert.Equal(t, st, got)

	// Envelope version is stamped.
	raw := readGUIConfigRaw(t, dir)
	assert.JSONEq(t, "1", string(raw["version"]))
}

// TestGUIConfigSaveWindowPreservesUnknownSections is the central guarantee of
// the single-owner design: writing the window section must not drop another
// section already present in gui.json (e.g. a future preferences section, or
// one written by a newer build).
func TestGUIConfigSaveWindowPreservesUnknownSections(t *testing.T) {
	dir := t.TempDir()
	// Seed a file that already carries an unrelated section.
	seed := `{"version":1,"preferences":{"showHiddenFiles":true,"theme":"dark"}}`
	require.NoError(t, os.WriteFile(filepath.Join(dir, guiConfigFileName), []byte(seed), 0o600))

	cfg := NewGUIConfig(dir)
	cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 2, Width: 800, Height: 600})

	raw := readGUIConfigRaw(t, dir)
	// Window section was written...
	require.Contains(t, raw, "window")
	// ...and the pre-existing unknown section survived untouched.
	require.Contains(t, raw, "preferences")
	assert.JSONEq(t, `{"showHiddenFiles":true,"theme":"dark"}`, string(raw["preferences"]))
}

func TestGUIConfigSaveWindowOverwritesExistingWindow(t *testing.T) {
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 1, Width: 100, Height: 100})
	cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 2, Y: 2, Width: 200, Height: 200})

	got, ok := cfg.LoadWindow()
	require.True(t, ok)
	assert.Equal(t, 2, got.X)
	assert.Equal(t, 200, got.Width)
}

func TestGUIConfigSaveWindowOnCorruptFileReplacesIt(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, guiConfigFileName), []byte("garbage"), 0o600))

	cfg := NewGUIConfig(dir)
	cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 5, Y: 5, Width: 640, Height: 480})

	got, ok := cfg.LoadWindow()
	require.True(t, ok)
	assert.Equal(t, 640, got.Width)
}

func TestGUIConfigSaveWindowMkdirFailureIsNonFatal(t *testing.T) {
	base := t.TempDir()
	blocker := filepath.Join(base, "blocker")
	f, err := os.Create(blocker)
	require.NoError(t, err)
	require.NoError(t, f.Close())

	cfg := NewGUIConfig(filepath.Join(blocker, "config"))
	assert.NotPanics(t, func() {
		cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 2, Width: 800, Height: 600})
	})
}

// --- injected-seam error branches ---------------------------------------

func TestGUIConfigReadNonNotExistError(t *testing.T) {
	cfg := NewGUIConfig(t.TempDir())
	cfg.readFile = func(string) ([]byte, error) { return nil, errors.New("permission denied") }

	// A read error that is not os.IsNotExist is logged and treated as "no state".
	_, ok := cfg.LoadWindow()
	assert.False(t, ok)
}

func TestGUIConfigWriteMarshalFailureIsNonFatal(t *testing.T) {
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	cfg.marshal = func(any) ([]byte, error) { return nil, errors.New("marshal boom") }

	assert.NotPanics(t, func() {
		cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 2, Width: 800, Height: 600})
	})
	// Nothing should have been written.
	_, err := os.Stat(filepath.Join(dir, guiConfigFileName))
	assert.True(t, os.IsNotExist(err))
}

func TestGUIConfigWriteFileFailureIsNonFatal(t *testing.T) {
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	cfg.writeFile = func(string, []byte, os.FileMode) error { return errors.New("disk full") }

	assert.NotPanics(t, func() {
		cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 2, Width: 800, Height: 600})
	})
	_, err := os.Stat(filepath.Join(dir, guiConfigFileName))
	assert.True(t, os.IsNotExist(err), "no final file when the temp write fails")
}

func TestGUIConfigRenameFailureIsNonFatalAndCleansTemp(t *testing.T) {
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	cfg.rename = func(string, string) error { return errors.New("rename failed") }

	assert.NotPanics(t, func() {
		cfg.SaveWindow(persistedWindowState{Version: windowStateVersion, X: 1, Y: 2, Width: 800, Height: 600})
	})
	// The temp file is removed on rename failure, and no final file exists.
	_, err := os.Stat(filepath.Join(dir, guiConfigFileName+".tmp"))
	assert.True(t, os.IsNotExist(err), "temp file should be cleaned up after a failed rename")
	_, err = os.Stat(filepath.Join(dir, guiConfigFileName))
	assert.True(t, os.IsNotExist(err))
}
