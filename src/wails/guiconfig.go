package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	log "github.com/sirupsen/logrus"
)

// guiConfigFileName is the single file holding GUI application preferences,
// written in the reused config directory alongside the first-launch marker.
//
// Today it carries only the window section. It is deliberately a general
// preferences file (not a window-only file) so future GUI settings - which are
// currently persisted in the browser's localStorage - can migrate here as
// sibling sections without a format change or a second file.
const guiConfigFileName = "gui.json"

// guiConfigVersion is the schema version of the gui.json envelope. It is
// distinct from the per-section version (e.g. persistedWindowState.Version) so
// the file and an individual section can evolve independently.
const guiConfigVersion = 1

// guiConfigFile is the on-disk shape of gui.json.
//
// Window is a pointer so an absent section marshals to null / is omitted rather
// than writing a zero-valued window block, and so Load can distinguish "no
// window saved yet" from "window saved with zero geometry". Future preference
// sections (notifications, file browser, etc.) are added here as additional
// omitempty pointer fields when the localStorage migration happens.
//
// extra captures any top-level keys this build does not know about (a section
// written by a newer version, or hand-added) so a read-modify-write save
// preserves them instead of silently dropping them. It is populated and
// re-emitted via custom (Un)MarshalJSON below.
type guiConfigFile struct {
	Version int                   `json:"version"`
	Window  *persistedWindowState `json:"window,omitempty"`

	extra map[string]json.RawMessage
}

// knownGUIConfigKeys are the top-level keys this build manages directly; every
// other key is round-tripped through guiConfigFile.extra.
var knownGUIConfigKeys = map[string]struct{}{
	"version": {},
	"window":  {},
}

// UnmarshalJSON decodes the known fields and stashes every other top-level key
// in extra, so unknown sections survive a later re-marshal.
func (c *guiConfigFile) UnmarshalJSON(data []byte) error {
	type alias guiConfigFile // avoid recursing into this method
	var known alias
	if err := json.Unmarshal(data, &known); err != nil {
		return err
	}
	*c = guiConfigFile(known)

	var all map[string]json.RawMessage
	if err := json.Unmarshal(data, &all); err != nil {
		return err
	}
	for k, v := range all {
		if _, isKnown := knownGUIConfigKeys[k]; isKnown {
			continue
		}
		if c.extra == nil {
			c.extra = make(map[string]json.RawMessage)
		}
		c.extra[k] = v
	}
	return nil
}

// MarshalJSON emits the known fields plus any preserved unknown sections.
func (c guiConfigFile) MarshalJSON() ([]byte, error) {
	type alias guiConfigFile
	known, err := json.Marshal(alias(c))
	if err != nil {
		return nil, err
	}
	if len(c.extra) == 0 {
		return known, nil
	}

	// Merge the known object with the preserved extras into one object.
	var merged map[string]json.RawMessage
	if err := json.Unmarshal(known, &merged); err != nil {
		return nil, err
	}
	for k, v := range c.extra {
		if _, isKnown := knownGUIConfigKeys[k]; isKnown {
			continue
		}
		merged[k] = v
	}
	return json.Marshal(merged)
}

// GUIConfig is the single owner (reader and writer) of gui.json. All persistence
// goes through it so the whole-file atomic replace can never drop a section
// written by another concern: each save is a read-modify-write under the lock
// that preserves every section it did not touch. Errors are logged and
// non-fatal - failing to persist a preference must never block the app.
//
// The filesystem and marshal calls are indirected through function fields so
// their (otherwise unreachable) error branches can be exercised in tests. They
// default to the real stdlib functions in NewGUIConfig.
type GUIConfig struct {
	filePath string
	mu       sync.Mutex

	readFile  func(name string) ([]byte, error)
	mkdirAll  func(path string, perm os.FileMode) error
	writeFile func(name string, data []byte, perm os.FileMode) error
	rename    func(oldpath, newpath string) error
	marshal   func(v any) ([]byte, error)
}

// NewGUIConfig creates a GUIConfig backed by gui.json inside the given
// userDataDir (the same config dir used for the first-launch marker).
func NewGUIConfig(userDataDir string) *GUIConfig {
	return &GUIConfig{
		filePath:  filepath.Join(userDataDir, guiConfigFileName),
		readFile:  os.ReadFile,
		mkdirAll:  os.MkdirAll,
		writeFile: os.WriteFile,
		rename:    os.Rename,
		marshal:   func(v any) ([]byte, error) { return json.MarshalIndent(v, "", "  ") },
	}
}

// read loads and parses gui.json. It returns a zero file (not nil) and false
// when no usable file exists (missing, unreadable, or malformed), so callers can
// treat a corrupt file the same as a missing one and start fresh. The caller
// must hold mu.
func (c *GUIConfig) read() (guiConfigFile, bool) {
	data, err := c.readFile(c.filePath)
	if err != nil {
		if !os.IsNotExist(err) {
			log.Warnf("Failed to read %s: %v", guiConfigFileName, err)
		}
		return guiConfigFile{}, false
	}

	var cfg guiConfigFile
	if err := json.Unmarshal(data, &cfg); err != nil {
		log.Warnf("Failed to parse %s, ignoring: %v", guiConfigFileName, err)
		return guiConfigFile{}, false
	}
	return cfg, true
}

// write persists the whole config atomically (temp file + rename) so a crash
// mid-write cannot leave gui.json truncated. The parent dir is created lazily,
// matching FirstLaunchDetector. The caller must hold mu. Errors are logged and
// swallowed.
func (c *GUIConfig) write(cfg guiConfigFile) {
	cfg.Version = guiConfigVersion

	dir := filepath.Dir(c.filePath)
	if err := c.mkdirAll(dir, 0o755); err != nil {
		log.Errorf("Failed to create directory for %s: %v", guiConfigFileName, err)
		return
	}

	data, err := c.marshal(cfg)
	if err != nil {
		log.Errorf("Failed to marshal %s: %v", guiConfigFileName, err)
		return
	}

	tmp := c.filePath + ".tmp"
	if err := c.writeFile(tmp, data, 0o600); err != nil {
		log.Errorf("Failed to write %s temp file: %v", guiConfigFileName, err)
		return
	}

	if err := c.rename(tmp, c.filePath); err != nil {
		log.Errorf("Failed to replace %s: %v", guiConfigFileName, err)
		_ = os.Remove(tmp)
	}
}

// LoadWindow returns the persisted window section, or (zero, false) when there
// is no usable window state (no file, corrupt file, missing section, or a
// section with an unexpected version / non-positive size).
func (c *GUIConfig) LoadWindow() (persistedWindowState, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg, ok := c.read()
	if !ok || cfg.Window == nil {
		return persistedWindowState{}, false
	}

	st := *cfg.Window
	if st.Version != windowStateVersion || st.Width <= 0 || st.Height <= 0 {
		log.Warnf("Discarding window section with unexpected version/size: %+v", st)
		return persistedWindowState{}, false
	}
	return st, true
}

// SaveWindow writes the window section, preserving every other section already
// in gui.json via a read-modify-write under the lock. A corrupt existing file is
// treated as empty and replaced.
func (c *GUIConfig) SaveWindow(st persistedWindowState) {
	c.mu.Lock()
	defer c.mu.Unlock()

	cfg, _ := c.read()
	cfg.Window = &st
	c.write(cfg)
}
