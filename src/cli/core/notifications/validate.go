package notifications

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

var metadataIP = net.ParseIP("169.254.169.254")

// ValidateDestinationName rejects empty names and any name that could escape the
// secret directory, because the name is used as a filename.
func ValidateDestinationName(name string) error {
	if strings.TrimSpace(name) == "" {
		return errors.New("destination name is required")
	}
	if strings.ContainsAny(name, `/\`) || strings.Contains(name, "..") {
		return errors.New("destination name contains illegal characters")
	}
	return nil
}

// ValidateWebhookURL enforces the SSRF guard. The daemon posts to this URL on the
// user's behalf (and a remote daemon posts from its own host), so the URL must be
// https and must not point back into the host or at a cloud metadata endpoint.
func ValidateWebhookURL(ctx context.Context, raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("invalid webhook url: %w", err)
	}
	if parsed.Scheme != "https" {
		return errors.New("webhook url must use https")
	}
	host := parsed.Hostname()
	if host == "" {
		return errors.New("webhook url has no host")
	}
	return validateHostNotInternal(ctx, host)
}

func validateHostNotInternal(ctx context.Context, host string) error {
	if literal := net.ParseIP(host); literal != nil {
		return checkIPAllowed(literal)
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("cannot resolve webhook host %q: %w", host, err)
	}
	for _, addr := range addrs {
		if err := checkIPAllowed(addr.IP); err != nil {
			return err
		}
	}
	return nil
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
