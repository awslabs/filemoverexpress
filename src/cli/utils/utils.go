package utils

import (
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "fmt"
    "log"
    "math"
    "os"
    "path"
    "path/filepath"
    "regexp"
    "strconv"
    "strings"
    "time"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/logger"
)

var (
    timeRangeRgx = regexp.MustCompile(`(?i)^\s*(\d+)\s*([mhdw])?\s*$`)
    uuidRgx      = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)
)

// StringArrayContains checks a haystack list of string and searches for the filter string. Returns true if the string
// was found, else false
func StringArrayContains(haystack []string, filter string) bool {
    for _, s := range haystack {
        if s == filter {
            return true
        }
    }
    return false
}

// ParseTimeRange takes a string input and parses it the number of seconds for the time range representation
func ParseTimeRange(input string) (int64, error) {
    var (
        validSlices = 3
        bitSize     = 32
    )
    if input == "" || input == "0" {
        return 0, nil
    }

    m := timeRangeRgx.FindStringSubmatch(input)

    if len(m) == validSlices {
        number, err := strconv.ParseInt(m[1], constants.BaseDecimal, bitSize)
        if err != nil {
            return 0, err
        }

        return timeToSeconds(number, m), nil
    }

    return 0, errors.New(strInvalidTimeFormat)
}

func timeToSeconds(number int64, m []string) int64 {
    switch strings.ToLower(m[2]) {
    case "m":
        return number * constants.MinuteInSeconds
    case "h":
        return number * constants.HourInSeconds
    case "d":
        return number * constants.DayInSeconds
    case "w":
        return number * constants.WeekInSeconds
    case "":
        return number
    }
    return number
}

// Capitalize ensures that the first character in the string is upper-cased, returns a new copy of the string
func Capitalize(input string) string {
    var re = regexp.MustCompile(`^\s*(\w)`)
    return re.ReplaceAllStringFunc(input, func(w string) string {
        return strings.ToUpper(w)
    })
}

// Sha256Hash takes in a string and returns the sha256 hash and error if any occurred
func Sha256Hash(s string) (string, error) {
    h := sha256.New()
    _, err := h.Write([]byte(s))

    if err != nil {
        logger.Warn(strErrorGeneratingSha256, err)
        return "", err
    }

    hash := hex.EncodeToString(h.Sum(nil))

    return hash, nil
}

func IsValidUUID(uuid string) bool {
    return uuidRgx.MatchString(uuid)
}

// CleanPrefix will take a delimiter and a variadic list of strings, and joins the strings with the delimiter as the
// separator. Finally, it will call path.Clean on the new string, and trim any leading slashes. This function guarantees
// that the string returned will end in a slash, unless it is the root, and in that case it will return an empty string.
//
//nolint:gci
//revive:disable:cyclomatic Breaking this function up may add more confusion and complexity
func CleanPrefix(delimiter string, inputs ...string) string {
    prefix := ""

    if len(inputs) > 0 {
        for _, i := range inputs {
            i := strings.TrimSpace(i)
            if len(i) > 0 {
                prefix = strings.Join([]string{prefix, i}, delimiter)
            }
        }
    }

    prefix = strings.TrimPrefix(path.Clean(prefix), delimiter)
    if prefix == "" || prefix == "." {
        return ""
    } else if strings.HasSuffix(prefix, delimiter) {
        return prefix
    }
    return prefix + delimiter
}

//revive:enable:cyclomatic

// LogPanic handles submitting logs for inspection when errors occur within the app
func LogPanic(data string) {
    logFile, err := openCrashLog()
    if err != nil {
        fmt.Println(strUnrecoverableError)
        fmt.Println(data)
        return
    }

    panicLog := log.New(logFile, "", log.LstdFlags|log.Lmsgprefix)
    panicLog.Print(data)

    err = logFile.Close()
    if err != nil {
        fmt.Printf(strFailedCloseCrashLog, err)
    }

    fmt.Printf(strUnrecoverableErrorLogged, logFile.Name())
}

// openCrashLog will attempt to open the crash.log file in the default log directory, or configured log directory if it exists.
// Returns a pointer to the File if successful, otherwise an error will be returned
func openCrashLog() (*os.File, error) {
    homeDir, err := os.UserHomeDir()
    if err != nil {
        return nil, fmt.Errorf(strFailedGettingHomeDir, err)
    }
    logDir := filepath.Join(homeDir, constants.DefaultAppDir, "logs")

    err = os.MkdirAll(logDir, 0755)
    if err != nil {
        return nil, fmt.Errorf(strFailedCreatingLogDir, err)
    }

    logFile, err := os.OpenFile(filepath.Join(logDir, "crash.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
    if err != nil {
        return nil, fmt.Errorf(strFailedOpenCrashLog, err)
    }

    return logFile, nil
}

// FormatBytes converts an integer number of bytes to a human-readable text representation
func FormatBytes(bytes int64) string {
    fb := float64(bytes)

    if bytes <= 0 {
        return "0 b"
    }

    var (
        k     float64 = 1024
        sizes         = []string{"Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"}
        i             = math.Floor(math.Log(fb) / math.Log(k))
    )

    return fmt.Sprintf("%.2f %s", fb/math.Pow(k, i), sizes[int(i)])
}

// CalculateTransferId returns a sha256 hash of the provided input arguments, adding on the current timestamp to allow
// for unique values over time
func CalculateTransferId(args ...string) (string, error) {
    return Sha256Hash(strings.Join(append(args, time.Now().String()), "-"))
}

func SizeFormat(b float64) string {
    const unit = 1024
    if b < unit {
        return fmt.Sprintf("%.2f B", b)
    }
    div, exp := int64(unit), 0
    for n := b / unit; n >= unit; n /= unit {
        div *= unit
        exp++
        if exp == len("KMGTPE")-1 {
            break
        }
    }
    return fmt.Sprintf("%.1f %ciB", b/float64(div), "KMGTPE"[exp])
}

func IsValidChecksumConfig(checksumAlgorithm string, checksumEnabled bool) bool {
    if checksumAlgorithm == string(constants.AlgorithmMD5) {
        return true
    }
    if checksumAlgorithm == string(constants.AlgorithmXXH3) {
        return true
    }
    if checksumAlgorithm == string(constants.AlgorithmXXHash64) {
        return true
    }
    if checksumAlgorithm == string(constants.AlgorithmXXHash) {
        return true
    }
    if checksumAlgorithm == string(constants.AlgorithmNone) {
        return !checksumEnabled
    }
    return false
}
