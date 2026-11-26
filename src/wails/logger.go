package main

import (
	"os"

	log "github.com/sirupsen/logrus"
)

// initLogger configures the application logger with a text formatter and the
// given log level.
func initLogger(level log.Level) {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})

	log.SetOutput(os.Stdout)
	log.SetLevel(level)
}
