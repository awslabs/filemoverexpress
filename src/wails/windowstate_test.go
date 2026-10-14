package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// fakeWindow is a test double implementing windowAccessor. It records the
// setters it receives and returns the geometry it is told to report.
type fakeWindow struct {
	x, y          int
	width, height int
	maximised     bool

	setX, setY   int
	setW, setH   int
	setPosCalled bool
	setSzCalled  bool
	maxCalled    bool
}

func (f *fakeWindow) Position() (int, int)   { return f.x, f.y }
func (f *fakeWindow) Size() (int, int)       { return f.width, f.height }
func (f *fakeWindow) IsMaximised() bool       { return f.maximised }
func (f *fakeWindow) SetPosition(x, y int)    { f.setX, f.setY, f.setPosCalled = x, y, true }
func (f *fakeWindow) SetSize(w, h int) application.Window {
	f.setW, f.setH, f.setSzCalled = w, h, true
	return nil
}
func (f *fakeWindow) Maximise() application.Window { f.maxCalled = true; return nil }

// newTestWindowState builds a WindowState backed by a GUIConfig in a temp dir
// with a fixed screen layout, bypassing the real Wails screen manager. It
// returns the WindowState, its backing GUIConfig, and the temp dir.
func newTestWindowState(t *testing.T, screens []application.Rect) (*WindowState, *GUIConfig, string) {
	t.Helper()
	dir := t.TempDir()
	cfg := NewGUIConfig(dir)
	ws := NewWindowState(cfg)
	ws.screens = func() []application.Rect { return screens }
	return ws, cfg, dir
}

// writeRawGUIConfig writes arbitrary bytes to gui.json, for malformed-input
// tests. seedWindowSection writes a window section with the given state through
// the normal GUIConfig path.
func writeRawGUIConfig(t *testing.T, dir string, data []byte) {
	t.Helper()
	require.NoError(t, os.WriteFile(filepath.Join(dir, guiConfigFileName), data, 0o600))
}

func seedWindowSection(t *testing.T, dir string, st persistedWindowState) {
	t.Helper()
	data, err := json.Marshal(guiConfigFile{Version: guiConfigVersion, Window: &st})
	require.NoError(t, err)
	writeRawGUIConfig(t, dir, data)
}

func singleScreen() []application.Rect {
	return []application.Rect{{X: 0, Y: 0, Width: 1920, Height: 1080}}
}

// --- Load ---------------------------------------------------------------

func TestWindowStateLoadMissingFile(t *testing.T) {
	ws, _, _ := newTestWindowState(t, singleScreen())
	_, ok := ws.Load()
	assert.False(t, ok, "missing file should load as not-ok")
}

func TestWindowStateLoadMalformed(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	writeRawGUIConfig(t, dir, []byte("{not json"))
	_, ok := ws.Load()
	assert.False(t, ok, "malformed file should load as not-ok")
}

func TestWindowStateLoadWrongVersion(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	seedWindowSection(t, dir, persistedWindowState{Version: 999, X: 10, Y: 10, Width: 800, Height: 600})
	_, ok := ws.Load()
	assert.False(t, ok, "unknown version should be discarded")
}

func TestWindowStateLoadNonPositiveSize(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	seedWindowSection(t, dir, persistedWindowState{Version: windowStateVersion, X: 10, Y: 10, Width: 0, Height: 600})
	_, ok := ws.Load()
	assert.False(t, ok, "non-positive size should be discarded")
}

func TestWindowStateLoadValid(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	st := persistedWindowState{Version: windowStateVersion, X: 100, Y: 120, Width: 1280, Height: 800, Maximised: true}
	seedWindowSection(t, dir, st)

	got, ok := ws.Load()
	require.True(t, ok)
	assert.Equal(t, st, got)
}

// --- capture ------------------------------------------------------------

func TestWindowStateCaptureNormal(t *testing.T) {
	ws, _, _ := newTestWindowState(t, singleScreen())
	w := &fakeWindow{x: 50, y: 60, width: 1000, height: 700, maximised: false}

	got := ws.capture(w)
	assert.Equal(t, persistedWindowState{
		Version: windowStateVersion, X: 50, Y: 60, Width: 1000, Height: 700, Maximised: false,
	}, got)
}

func TestWindowStateCaptureMaximizedPreservesNormalGeometry(t *testing.T) {
	ws, _, _ := newTestWindowState(t, singleScreen())
	// Seed a known normal geometry.
	ws.current = persistedWindowState{Version: windowStateVersion, X: 50, Y: 60, Width: 1000, Height: 700}

	// A maximized window reports full-screen bounds, which must NOT overwrite the
	// stored normal rectangle; only the flag flips.
	w := &fakeWindow{x: 0, y: 0, width: 1920, height: 1080, maximised: true}
	got := ws.capture(w)

	assert.True(t, got.Maximised)
	assert.Equal(t, 50, got.X)
	assert.Equal(t, 60, got.Y)
	assert.Equal(t, 1000, got.Width)
	assert.Equal(t, 700, got.Height)
}

func TestWindowStateCaptureMaximizedFirstEverFallsBackToDefault(t *testing.T) {
	ws, _, _ := newTestWindowState(t, singleScreen())
	// No prior normal geometry observed.
	w := &fakeWindow{maximised: true}
	got := ws.capture(w)

	assert.True(t, got.Maximised)
	assert.Equal(t, DefaultWindowWidth, got.Width)
	assert.Equal(t, DefaultWindowHeight, got.Height)
	assert.Equal(t, 0, got.X)
	assert.Equal(t, 0, got.Y)
}

// --- SaveNow / write ----------------------------------------------------

func TestWindowStateSaveNowRoundTrip(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	w := &fakeWindow{x: 11, y: 22, width: 1300, height: 820, maximised: false}

	ws.SaveNow(w)

	// Re-read from a fresh instance to prove it persisted.
	ws2 := NewWindowState(NewGUIConfig(dir))
	ws2.screens = ws.screens
	got, ok := ws2.Load()
	require.True(t, ok)
	assert.Equal(t, persistedWindowState{
		Version: windowStateVersion, X: 11, Y: 22, Width: 1300, Height: 820,
	}, got)

	// No temp file left behind.
	_, err := os.Stat(filepath.Join(dir, guiConfigFileName+".tmp"))
	assert.True(t, os.IsNotExist(err), "temp file should be renamed away")
}

func TestWindowStateSaveNowMkdirFailureIsNonFatal(t *testing.T) {
	base := t.TempDir()
	// A regular file where a directory is needed makes MkdirAll fail.
	blocker := filepath.Join(base, "blocker")
	f, err := os.Create(blocker)
	require.NoError(t, err)
	require.NoError(t, f.Close())

	ws := NewWindowState(NewGUIConfig(filepath.Join(blocker, "config")))
	ws.screens = singleScreen

	// Must not panic; the error is logged and swallowed.
	assert.NotPanics(t, func() {
		ws.SaveNow(&fakeWindow{x: 1, y: 2, width: 800, height: 600})
	})
}

func TestWindowStateSaveNowCreatesParentDir(t *testing.T) {
	base := t.TempDir()
	nested := filepath.Join(base, "a", "b", "config")
	ws := NewWindowState(NewGUIConfig(nested))
	ws.screens = singleScreen
	w := &fakeWindow{x: 1, y: 2, width: 800, height: 600}

	ws.SaveNow(w)

	_, err := os.Stat(filepath.Join(nested, guiConfigFileName))
	assert.NoError(t, err, "parent dir should be created lazily")
}

func TestWindowStateSaveNowCancelsPendingDebounce(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())

	// Schedule a debounced save (arms the timer)...
	ws.ScheduleSave(&fakeWindow{x: 1, y: 1, width: 800, height: 600})
	// ...then flush synchronously with different geometry before the timer fires.
	ws.SaveNow(&fakeWindow{x: 9, y: 9, width: 1234, height: 777})

	ws2 := NewWindowState(NewGUIConfig(dir))
	ws2.screens = ws.screens
	got, ok := ws2.Load()
	require.True(t, ok)
	// The synchronous SaveNow geometry wins; the cancelled debounce never overwrites it.
	assert.Equal(t, 1234, got.Width)
	assert.Equal(t, 9, got.X)
}

func TestWindowStateScheduleSaveDebouncedWrite(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	w := &fakeWindow{x: 5, y: 6, width: 900, height: 650}

	ws.ScheduleSave(w)

	// Nothing written synchronously.
	_, err := os.Stat(filepath.Join(dir, guiConfigFileName))
	assert.True(t, os.IsNotExist(err), "debounced save should not write immediately")

	assert.Eventually(t, func() bool {
		_, err := os.Stat(filepath.Join(dir, guiConfigFileName))
		return err == nil
	}, 2*time.Second, 20*time.Millisecond, "debounced save should write after the delay")
}

func TestWindowStateScheduleSaveCoalesces(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())

	ws.ScheduleSave(&fakeWindow{x: 1, y: 1, width: 800, height: 600})
	ws.ScheduleSave(&fakeWindow{x: 2, y: 2, width: 801, height: 601})
	ws.ScheduleSave(&fakeWindow{x: 3, y: 3, width: 802, height: 602})

	assert.Eventually(t, func() bool {
		_, err := os.Stat(filepath.Join(dir, guiConfigFileName))
		return err == nil
	}, 2*time.Second, 20*time.Millisecond)

	ws2 := NewWindowState(NewGUIConfig(dir))
	ws2.screens = ws.screens
	got, ok := ws2.Load()
	require.True(t, ok)
	assert.Equal(t, 3, got.X, "only the latest geometry should be persisted")
	assert.Equal(t, 802, got.Width)
}

// --- Restore ------------------------------------------------------------

func TestWindowStateRestoreNoStateReturnsFalse(t *testing.T) {
	ws, _, _ := newTestWindowState(t, singleScreen())
	w := &fakeWindow{}
	assert.False(t, ws.Restore(w))
	assert.False(t, w.setPosCalled)
	assert.False(t, w.setSzCalled)
}

func TestWindowStateRestoreOffScreenReturnsFalse(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	// Saved far off to the right of the only 1920x1080 screen.
	seedWindowSection(t, dir, persistedWindowState{Version: windowStateVersion, X: 5000, Y: 5000, Width: 800, Height: 600})

	w := &fakeWindow{}
	assert.False(t, ws.Restore(w), "off-screen state should not be restored")
	assert.False(t, w.setPosCalled)
}

func TestWindowStateRestoreValidNormal(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	seedWindowSection(t, dir, persistedWindowState{Version: windowStateVersion, X: 100, Y: 120, Width: 1280, Height: 800, Maximised: false})

	w := &fakeWindow{}
	require.True(t, ws.Restore(w))
	assert.Equal(t, 1280, w.setW)
	assert.Equal(t, 800, w.setH)
	assert.Equal(t, 100, w.setX)
	assert.Equal(t, 120, w.setY)
	assert.False(t, w.maxCalled, "non-maximized state must not maximize")
}

func TestWindowStateRestoreValidMaximized(t *testing.T) {
	ws, _, dir := newTestWindowState(t, singleScreen())
	seedWindowSection(t, dir, persistedWindowState{Version: windowStateVersion, X: 100, Y: 120, Width: 1280, Height: 800, Maximised: true})

	w := &fakeWindow{}
	require.True(t, ws.Restore(w))
	// Normal bounds applied first...
	assert.Equal(t, 1280, w.setW)
	assert.Equal(t, 100, w.setX)
	// ...then maximized.
	assert.True(t, w.maxCalled, "maximized flag should trigger Maximise()")
}

// --- fitsAnyScreen / intersectionSize -----------------------------------

func TestFitsAnyScreenTitleBarVisible(t *testing.T) {
	screens := []application.Rect{
		{X: 0, Y: 0, Width: 1920, Height: 1080},
		{X: 1920, Y: 0, Width: 1280, Height: 1024},
	}

	tests := []struct {
		name string
		st   persistedWindowState
		want bool
	}{
		{"fully on primary", persistedWindowState{X: 10, Y: 10, Width: 800, Height: 600}, true},
		{"fully on secondary", persistedWindowState{X: 2000, Y: 10, Width: 800, Height: 600}, true},
		// Title bar spans 1800..2200; 120px of it sits on the primary (1800..1920),
		// above the 100px minimum, so the window is grabbable.
		{"straddle with grabbable title bar", persistedWindowState{X: 1800, Y: 10, Width: 400, Height: 600}, true},
		{"fully off-screen right", persistedWindowState{X: 5000, Y: 10, Width: 800, Height: 600}, false},
		// Window body overlaps the primary but the title bar is above the work area
		// (negative Y), so the top edge is off-screen.
		{"title bar above work area", persistedWindowState{X: 10, Y: -100, Width: 800, Height: 600}, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, fitsAnyScreen(tc.st, screens))
		})
	}
}

func TestFitsAnyScreenSliverAfterMonitorUnplug(t *testing.T) {
	// External (secondary) monitor unplugged: only the primary remains. A window
	// that was positioned near the right edge of the primary now has only a 20px
	// sliver of its title bar on-screen (1900..1920), below the 100px minimum, so
	// the top bar is effectively unreachable and the restore must be rejected.
	primaryOnly := []application.Rect{{X: 0, Y: 0, Width: 1920, Height: 1080}}
	st := persistedWindowState{X: 1900, Y: 10, Width: 400, Height: 600}
	assert.False(t, fitsAnyScreen(st, primaryOnly), "a 20px title-bar sliver is not grabbable")
}

func TestFitsAnyScreenClampsStripToShortWindow(t *testing.T) {
	// A window shorter than titleBarHeight must still validate against its own
	// (clamped) height rather than reporting zero visible height.
	screens := []application.Rect{{X: 0, Y: 0, Width: 1920, Height: 1080}}
	st := persistedWindowState{X: 10, Y: 10, Width: 400, Height: 20}
	assert.True(t, fitsAnyScreen(st, screens))
}

func TestFitsAnyScreenIgnoresZeroAreaScreens(t *testing.T) {
	screens := []application.Rect{{X: 0, Y: 0, Width: 0, Height: 0}}
	st := persistedWindowState{X: 0, Y: 0, Width: 800, Height: 600}
	assert.False(t, fitsAnyScreen(st, screens), "a zero-area screen cannot anchor a window")
}

func TestIntersectionSize(t *testing.T) {
	a := application.Rect{X: 0, Y: 0, Width: 100, Height: 100}

	w, h := intersectionSize(a, application.Rect{X: 50, Y: 50, Width: 100, Height: 100})
	assert.Equal(t, 50, w)
	assert.Equal(t, 50, h)

	w, h = intersectionSize(a, application.Rect{X: 100, Y: 0, Width: 100, Height: 100})
	assert.Equal(t, 0, w, "edge-adjacent is not overlap")
	assert.Equal(t, 0, h)

	w, h = intersectionSize(a, application.Rect{X: 200, Y: 200, Width: 10, Height: 10})
	assert.Equal(t, 0, w)
	assert.Equal(t, 0, h)
}
