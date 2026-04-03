//go:build !windows

package serviceutils

func ConvertPathFromGRPC(inputPath string) string {
    return inputPath
}
