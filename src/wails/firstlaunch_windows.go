//go:build windows

package main

import (
	"syscall"
	"unsafe"
)

// hideFile sets the hidden file attribute on the given file path using the
// Windows SetFileAttributes API. This makes the file invisible in Explorer
// unless "Show hidden files" is enabled.
func hideFile(path string) error {
	ptr, err := syscall.UTF16PtrFromString(path)
	if err != nil {
		return err
	}

	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	setFileAttributes := kernel32.NewProc("SetFileAttributesW")

	const fileAttributeHidden = 0x2

	r1, _, err := setFileAttributes.Call(
		uintptr(unsafe.Pointer(ptr)),
		uintptr(fileAttributeHidden),
	)
	if r1 == 0 {
		return err
	}

	return nil
}
