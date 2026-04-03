package fs

import (
    "fmt"
    "os"
    "path"
    "path/filepath"
    "strings"
)

// PathExists checks to see if the provided path exists on disk, returning a simple boolean response
func PathExists(input string) (bool, error) {
    _, err := os.Stat(input)
    if err != nil {
        if os.IsNotExist(err) {
            return false, nil
        }

        return false, err
    }

    return true, nil
}

// PathIsDir checks to see if a path exists, and if the path exists returns true if the path exists and is a directory
func PathIsDir(input string) (bool, error) {
    info, err := os.Stat(input)
    if err != nil {
        return false, err
    }

    return info.IsDir(), nil
}

// PathIsFile checks to see if a path exists, and if the path exists returns true if the path is a regular file
func PathIsFile(input string) (bool, error) {
    info, err := os.Stat(input)
    if err != nil {
        return false, err
    }

    return !info.IsDir(), nil
}

func ConvertPathToGRPC(winPath string) string {
    parts := strings.SplitN(winPath, ":", 2)
    return fmt.Sprintf(
        "/%s/%s",
        parts[0],
        path.Join(strings.Split(parts[1], "\\")...),
    )
}

func ConvertPathToWindows(grpcPath string) (string, error) {
    if grpcPath == "/" || grpcPath == "" {
        return "/", nil
    }
    parts := strings.SplitN(strings.TrimPrefix(grpcPath, "/"), "/", 2)
    if len(parts) == 1 {
        return constructWinPath(parts[0], "/"), nil
    } else if len(parts) == 2 {
        return constructWinPath(parts[0], parts[1]), nil
    }
    return "/", fmt.Errorf("invalid grpcPath given: %s", grpcPath)
}

func constructWinPath(driveLetter string, drivePath string) string {
    winPath := filepath.Join(strings.Split(drivePath, "/")...)
    if winPath == "" {
        return fmt.Sprintf("%s:\\", driveLetter)
    }

    return fmt.Sprintf("%s:\\%s", driveLetter, winPath)
}

func LongestCommonDirectories(absolutePaths []string) string {
    for _, source := range absolutePaths {
        if !filepath.IsAbs(source) {
            return ""
        }
    }

    if len(absolutePaths) == 0 {
        return ""
    }
    if len(absolutePaths) == 1 {
        dir, _ := filepath.Split(absolutePaths[0])
        return dir
    }

    // stores the length of common characters and initialized with the length of first string.
    commonCharacters := len(absolutePaths[0])

    // stores the common string and initialized with the first string.
    commonString := absolutePaths[0]

    for i := 1; i < len(absolutePaths); i++ {
        iter := absolutePaths[i]
        n := min(len(commonString), len(iter))
        j := 0
        for j < n && commonString[j] == iter[j] {
            j++
        }
        if j < commonCharacters {
            commonCharacters = j
        }
        if iter > commonString {
            commonString = iter
        }
    }

    // In 'found' variable we store the index of '/' in the length of common characters in commonString
    found := -1
    for i := min(commonCharacters, len(commonString)-1); i >= 0; i-- {
        if string(commonString[i]) == string(filepath.Separator) {
            found = i
            break
        }
    }

    return commonString[0:found] + string(filepath.Separator)
}
