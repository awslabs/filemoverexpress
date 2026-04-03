package discovery

import (
    "fmt"
)

type DiscoveryError struct {
    format string
    values []any
}

func (de DiscoveryError) Error() string {
    return fmt.Sprintf(de.format, de.values...)
}

func NewDiscoveryError(format string, values ...any) DiscoveryError {
    return DiscoveryError{
        format: format,
        values: values,
    }
}
