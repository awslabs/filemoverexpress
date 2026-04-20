// Package logger abstracts the logrus package.
package logger

import (
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/natefinch/lumberjack"
	"github.com/shiena/ansicolor"
	"github.com/sirupsen/logrus"

	"github.com/awslabs/filemoverexpress/constants"
)

// Different logging levels for setting message severity.
const (
	exitDelay           = 500 * time.Millisecond
	PanicLevel LogLevel = "panic"
	FatalLevel LogLevel = "fatal"
	ErrorLevel LogLevel = "error"
	WarnLevel  LogLevel = "warn"
	InfoLevel  LogLevel = "info"
	DebugLevel LogLevel = "debug"
	TraceLevel LogLevel = "trace"
)

var (
	clog *logrus.Logger
	flog *logrus.Logger
)

type (
	LogLevel string
	Config   struct {
		Severity logrus.Level
		LogPath  string
		MaxSize  int
		MaxAge   int
		Compress bool
	}
)

func exithandler() {
	// gracefully shutdown something...
	time.Sleep(exitDelay)
}

// Init configures the logging level and sets the log file path.
func Init(config *Config) error {
	logrus.RegisterExitHandler(exithandler)

	clog = logrus.New()
	clog.SetLevel(config.Severity)
	clog.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:          true,
		ForceColors:            true,
		DisableLevelTruncation: true,
		PadLevelText:           true,
		TimestampFormat:        "2006-01-02 15:04:05",
	})
	clog.SetOutput(ansicolor.NewAnsiColorWriter(os.Stdout))

	logpath := config.LogPath
	if logpath == "" {
		return errors.New(strLogDirNotConfigured)
	}

	logfile := filepath.Join(logpath, constants.DefaultLogFilename)
	flog = logrus.New()
	flog.SetLevel(config.Severity)
	flog.SetFormatter(&logrus.JSONFormatter{TimestampFormat: "2006-01-02 15:04:05"})
	flog.SetOutput(&lumberjack.Logger{
		Filename:  logfile,
		MaxSize:   config.MaxSize,
		MaxAge:    config.MaxAge,
		Compress:  config.Compress,
		LocalTime: true,
	})

	return nil
}

// SendLog logs a message at a specified level on the standard logger.
func SendLog(lvl LogLevel, message string, args ...interface{}) {
	levelMap := map[LogLevel]func(string, ...interface{}){
		PanicLevel: Panic,
		FatalLevel: Fatal,
		ErrorLevel: Error,
		WarnLevel:  Warn,
		InfoLevel:  Info,
		DebugLevel: Debug,
		TraceLevel: Trace,
	}

	if fn, ok := levelMap[lvl]; ok {
		fn(FormatLogMessage(message, args))
	} else {
		Error(FormatLogMessage(message, args))
	}
}

func Trace(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Trace(formatted)
	}

	if flog != nil {
		flog.Trace(formatted)
	}
}

func Debug(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Debug(formatted)
	}

	if flog != nil {
		flog.Debug(formatted)
	}
}

func Info(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Info(formatted)
	}

	if flog != nil {
		flog.Info(formatted)
	}
}

func Warn(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Warn(formatted)
	}

	if flog != nil {
		flog.Warn(formatted)
	}
}

func Error(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Error(formatted)
	}

	if flog != nil {
		flog.Error(formatted)
	}
}

func Fatal(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Fatal(formatted)
	}

	if flog != nil {
		flog.Fatal(formatted)
	}
}

func Panic(message string, args ...interface{}) {
	formatted := FormatLogMessage(message, args)
	if clog != nil {
		clog.Trace(formatted)
	}

	if flog != nil {
		flog.Panic(formatted)
	}
}
