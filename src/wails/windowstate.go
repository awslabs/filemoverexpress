package main

import (
	"sync"
	"time"

	log "github.com/sirupsen/logrus"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// windowStateVersion is the schema version of the window section inside
// gui.json. It lets a future format change discard an incompatible older
// section instead of misinterpreting it, independently of the file envelope
// version (guiConfigVersion).
const windowStateVersion = 1

// windowStateSaveDebounce is how long move/resize events are coalesced before a
// write. Dragging a window fires many events; this batches them into one write.
const windowStateSaveDebounce = 500 * time.Millisecond

// persistedWindowState is the on-disk shape of the "window" section of gui.json.
//
// X/Y/Width/Height always describe the last NON-maximized geometry. When the
// window is closed while maximized, Maximised is true but the geometry still
// holds the last normal rectangle, so a restore maximizes the window yet
// un-maximizing returns it to a sane size and position.
type persistedWindowState struct {
	Version   int  `json:"version"`
	X         int  `json:"x"`
	Y         int  `json:"y"`
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	Maximised bool `json:"maximised"`
}

// windowAccessor abstracts the subset of application.Window that WindowState
// needs. The chained methods return application.Window to match the real
// interface exactly so *application.WebviewWindow satisfies it; the returned
// value is unused here and a fake may return nil.
type windowAccessor interface {
	Position() (int, int)
	Size() (width, height int)
	SetPosition(x, y int)
	SetSize(width, height int) application.Window
	Maximise() application.Window
	IsMaximised() bool
}

// screenProvider returns the work areas of all currently connected displays,
// used to validate that a saved position is still on-screen. It is a function
// field so tests can supply fixed screen geometry.
type screenProvider func() []application.Rect

// WindowState persists and restores the application window's size, position and
// maximized flag across launches. The geometry logic (capture, debounce,
// sanitation, restore) lives here; the actual bytes are read and written
// through GUIConfig, which owns gui.json and keeps the window section beside
// any other GUI preferences. All errors are logged and non-fatal - a failure to
// persist geometry must never block the app.
type WindowState struct {
	config  *GUIConfig
	screens screenProvider

	mu      sync.Mutex
	current persistedWindowState
	loaded  bool

	timer *time.Timer
}

// NewWindowState creates a WindowState that persists through the given
// GUIConfig (which owns gui.json in the reused config directory).
func NewWindowState(config *GUIConfig) *WindowState {
	return &WindowState{
		config:  config,
		screens: allScreenWorkAreas,
	}
}

// Load returns the persisted window state and true if a valid section was read,
// or a zero state and false when none exists. The result is cached so later
// saves can preserve the normal geometry while the window is maximized.
func (ws *WindowState) Load() (persistedWindowState, bool) {
	st, ok := ws.config.LoadWindow()
	if !ok {
		return persistedWindowState{}, false
	}

	ws.mu.Lock()
	ws.current = st
	ws.loaded = true
	ws.mu.Unlock()
	return st, true
}

// capture reads the current geometry from the window. When the window is
// maximized it keeps the previously stored normal rectangle and only sets the
// Maximised flag, so the maximized bounds never overwrite the normal geometry.
func (ws *WindowState) capture(w windowAccessor) persistedWindowState {
	if w.IsMaximised() {
		prev := ws.current
		prev.Version = windowStateVersion
		prev.Maximised = true
		if prev.Width <= 0 || prev.Height <= 0 {
			// No normal geometry was ever observed (e.g. the very first launch
			// opened, maximized, and closed). Fall back to the centered default
			// so the un-maximize target is still valid.
			prev.Width = DefaultWindowWidth
			prev.Height = DefaultWindowHeight
			prev.X, prev.Y = 0, 0
		}
		return prev
	}

	x, y := w.Position()
	width, height := w.Size()
	return persistedWindowState{
		Version:   windowStateVersion,
		X:         x,
		Y:         y,
		Width:     width,
		Height:    height,
		Maximised: false,
	}
}

// ScheduleSave debounces a save triggered by a move/resize event. Multiple
// events within the debounce window collapse into a single write of the latest
// geometry.
func (ws *WindowState) ScheduleSave(w windowAccessor) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	ws.current = ws.capture(w)
	ws.loaded = true

	if ws.timer != nil {
		ws.timer.Stop()
	}
	ws.timer = time.AfterFunc(windowStateSaveDebounce, func() {
		ws.mu.Lock()
		st := ws.current
		ws.mu.Unlock()
		ws.config.SaveWindow(st)
	})
}

// SaveNow captures and writes the geometry synchronously, cancelling any pending
// debounced write. It is called from the close/quit seam so the final state
// (including the maximized flag, which Linux/GTK never reports via events) is
// always flushed authoritatively.
func (ws *WindowState) SaveNow(w windowAccessor) {
	ws.mu.Lock()
	if ws.timer != nil {
		ws.timer.Stop()
		ws.timer = nil
	}
	st := ws.capture(w)
	ws.current = st
	ws.loaded = true
	ws.mu.Unlock()

	ws.config.SaveWindow(st)
}

// Restore applies the saved geometry to the window if a valid, on-screen state
// exists, and reports whether it did so. When no usable state exists the caller
// falls back to centering. The normal size and position are applied first, then
// Maximise() if the saved flag is set, so an un-maximize returns to the stored
// normal rectangle.
func (ws *WindowState) Restore(w windowAccessor) bool {
	st, ok := ws.Load()
	if !ok {
		return false
	}

	if !fitsAnyScreen(st, ws.screens()) {
		log.Debugf("Saved window position is off-screen, ignoring: %+v", st)
		return false
	}

	w.SetSize(st.Width, st.Height)
	w.SetPosition(st.X, st.Y)
	if st.Maximised {
		w.Maximise()
	}
	return true
}

// titleBarHeight is the height of the top strip of the window treated as the
// draggable title-bar / app top-bar region for the on-screen check. The window
// is frameless (no OS title bar), so this is the app's own top bar; it only has
// to be a band tall enough to represent "the top of the window is visible".
const titleBarHeight = 32

// minVisibleTitleBarWidth is how much of the title-bar strip must land inside a
// single display's work area for a restore to be accepted. It guarantees the
// user can always see and grab the window to move it, even if the rest of the
// window spills past the screen edge.
const minVisibleTitleBarWidth = 100

// fitsAnyScreen reports whether the saved window can be restored with its title
// bar reachable. Rather than any-overlap, it requires that at least
// minVisibleTitleBarWidth pixels of the window's top strip fall within one
// display's work area. This rejects both the fully-off-screen case (an unplugged
// monitor, a resolution change) and the partial-straddle case where only a sliver
// of the window body is visible but the draggable top bar is off-screen, which
// would leave the window stuck. When it returns false the caller centers instead.
func fitsAnyScreen(st persistedWindowState, screens []application.Rect) bool {
	// The title-bar strip across the top of the saved window. Clamp its height to
	// the window height so a tiny saved window is still handled sanely.
	stripHeight := titleBarHeight
	if st.Height < stripHeight {
		stripHeight = st.Height
	}
	titleBar := application.Rect{X: st.X, Y: st.Y, Width: st.Width, Height: stripHeight}

	for _, wa := range screens {
		if wa.Width <= 0 || wa.Height <= 0 {
			continue
		}
		visibleWidth, visibleHeight := intersectionSize(titleBar, wa)
		if visibleHeight > 0 && visibleWidth >= minVisibleTitleBarWidth {
			return true
		}
	}
	return false
}

// intersectionSize returns the width and height of the overlapping region of two
// rectangles, or (0, 0) when they do not overlap.
func intersectionSize(a, b application.Rect) (width, height int) {
	left := max(a.X, b.X)
	right := min(a.X+a.Width, b.X+b.Width)
	top := max(a.Y, b.Y)
	bottom := min(a.Y+a.Height, b.Y+b.Height)
	if right <= left || bottom <= top {
		return 0, 0
	}
	return right - left, bottom - top
}

// allScreenWorkAreas enumerates the work areas of every connected display via
// the package-level screen accessor. Index enumeration stops at the first nil,
// which is how the Wails screen manager signals the end of the list.
func allScreenWorkAreas() []application.Rect {
	var areas []application.Rect
	for i := 0; ; i++ {
		s := application.GetScreenByIndex(i)
		if s == nil {
			break
		}
		areas = append(areas, s.WorkArea)
	}
	return areas
}
