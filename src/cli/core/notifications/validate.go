package notifications

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"regexp"
	"strings"
)

const maxDestinationNameLen = 128

var (
	metadataIP = net.ParseIP("169.254.169.254")

	// destNameAllowed is an allowlist: a destination name may only contain ASCII
	// letters, digits, spaces, and the three safe punctuation marks _ . and -.
	// This is stricter and safer than a denylist - it rejects path separators,
	// NUL, ":" (an NTFS alternate-data-stream separator), and every other control
	// or special character outright, rather than trying to enumerate the bad ones.
	destNameAllowed = regexp.MustCompile(`^[A-Za-z0-9 _.-]+$`)

	// reservedDeviceNames are Windows reserved device names. A file called "CON"
	// or "NUL" is a device, not a file, so a destination by that name must be
	// rejected even though it passes the character allowlist.
	reservedDeviceNames = map[string]struct{}{
		"CON": {}, "PRN": {}, "AUX": {}, "NUL": {},
		"COM1": {}, "COM2": {}, "COM3": {}, "COM4": {}, "COM5": {},
		"COM6": {}, "COM7": {}, "COM8": {}, "COM9": {},
		"LPT1": {}, "LPT2": {}, "LPT3": {}, "LPT4": {}, "LPT5": {},
		"LPT6": {}, "LPT7": {}, "LPT8": {}, "LPT9": {},
	}
)

// PublicError marks a validation failure whose message is safe to return to a
// settings-only client over RPC: it names a user-fixable misconfiguration (bad
// scheme, missing host, a non-routable target, an error status from the webhook)
// and never carries the webhook secret. Transport, DNS, parse and store errors
// are NOT wrapped, so they stay behind a generic message at the RPC boundary.
// Error() returns the full detail for the daemon log; public carries the
// client-safe text, which for the host case is sanitized to avoid echoing a
// resolved internal IP to a remote settings client.
type PublicError struct {
	public string
	err    error
}

func (e *PublicError) Error() string { return e.err.Error() }
func (e *PublicError) Unwrap() error { return e.err }

// newPublicError wraps err whose own message is already client-safe.
func newPublicError(err error) *PublicError {
	return &PublicError{public: err.Error(), err: err}
}

// newSanitizedPublicError keeps err (with its detail) for the log but surfaces a
// separate sanitized message to the client.
func newSanitizedPublicError(public string, err error) *PublicError {
	return &PublicError{public: public, err: err}
}

// PublicMessage returns the client-safe message and true when err, or something
// it wraps, is a *PublicError.
func PublicMessage(err error) (string, bool) {
	var pe *PublicError
	if errors.As(err, &pe) {
		return pe.public, true
	}
	return "", false
}

// ValidateDestinationName enforces an allowlist on names used as secret-store
// filenames. It accepts letters, digits, spaces, and _ . - up to a length cap,
// with no leading or trailing dot or space, and rejects Windows reserved device
// names. This keeps the name a plain file inside the store directory: path
// separators, "..", ":", NUL and other specials never pass the allowlist, so the
// name cannot escape the directory or name a device or alternate data stream.
// Unlike the previous denylist, an ordinary name containing ".." (e.g. "v1..2")
// is accepted, because the allowlist contains it rather than escaping.
func ValidateDestinationName(name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("destination name is required")
	}
	if len(name) > maxDestinationNameLen {
		return fmt.Errorf("destination name must be at most %d characters", maxDestinationNameLen)
	}
	if !destNameAllowed.MatchString(name) {
		return errors.New("destination name may only contain letters, numbers, spaces, and _ . -")
	}
	if first, last := name[0], name[len(name)-1]; first == '.' || first == ' ' || last == '.' || last == ' ' {
		return errors.New("destination name must not start or end with a dot or space")
	}
	// Windows treats "CON", and equally "CON.anything", as the device: the
	// component before the first dot is what names it, and the store file is
	// "<name>.enc". Check that leading component, uppercased, so "CON.x" and
	// "NUL.backup" are rejected, not just the bare "CON".
	base := name
	if dot := strings.IndexByte(name, '.'); dot >= 0 {
		base = name[:dot]
	}
	if _, reserved := reservedDeviceNames[strings.ToUpper(base)]; reserved {
		return errors.New("destination name is a reserved device name")
	}
	return nil
}

// ValidateWebhookURL enforces the SSRF guard. The daemon posts to this URL on the
// user's behalf (and a remote daemon posts from its own host), so the URL must be
// https and must not point back into the host or at a cloud metadata endpoint.
func ValidateWebhookURL(ctx context.Context, raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		// url.Parse returns *url.Error, whose Error() echoes the raw input (which,
		// for a misconfigured destination, could be arbitrary decrypted bytes).
		// Keep the "invalid webhook url" context but wrap only the inner reason
		// (.Err never contains the URL), so the message stays secret-safe.
		var uerr *url.Error
		if errors.As(err, &uerr) {
			// uerr.Err is the reason only and never carries the raw input, so the
			// message is already redacted. Mark it public: a malformed URL is
			// user-fixable, and the user should see why rather than a generic save
			// error. (The raw URL, which can hold a secret, is dropped with uerr.)
			return newPublicError(fmt.Errorf("invalid webhook url: %w", uerr.Err))
		}
		return fmt.Errorf("invalid webhook url: %w", err)
	}
	if parsed.Scheme != "https" {
		return newPublicError(errors.New("webhook url must use https"))
	}
	host := parsed.Hostname()
	if host == "" {
		return newPublicError(errors.New("webhook url has no host"))
	}
	return validateHostNotInternal(ctx, host)
}

func validateHostNotInternal(ctx context.Context, host string) error {
	if literal := net.ParseIP(host); literal != nil {
		if err := checkIPAllowed(literal); err != nil {
			return publicHostNotAllowed(err)
		}
		return nil
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("cannot resolve webhook host %q: %w", host, err)
	}
	for _, addr := range addrs {
		if err := checkIPAllowed(addr.IP); err != nil {
			return publicHostNotAllowed(err)
		}
	}
	return nil
}

// publicHostNotAllowed surfaces a fixed, sanitized reason to the client (so a
// remote settings client never learns the resolved internal IP) while keeping
// the detailed address in the wrapped error for the daemon log.
func publicHostNotAllowed(err error) error {
	return newSanitizedPublicError(
		"webhook host is not allowed (resolves to a private, loopback, or metadata address)", err)
}

func checkIPAllowed(ip net.IP) error {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("webhook host resolves to a non-routable address (%s)", ip)
	}
	if ip.Equal(metadataIP) {
		return errors.New("webhook host resolves to the instance metadata endpoint")
	}
	return nil
}
