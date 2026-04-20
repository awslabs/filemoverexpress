//go:build !windows

package discovery

func ValidatePathLength(_ string) error {
	return nil
}
