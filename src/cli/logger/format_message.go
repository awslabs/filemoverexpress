package logger

import "fmt"

func FormatLogMessage(message string, args []interface{}) string {
    if len(args) > 0 {
        return fmt.Sprintf(message, args...)
    }

    return message
}
