package main

import (
	"os"

	log "github.com/sirupsen/logrus"
)

// initLogger configures the application logger with a text formatter and
// appropriate log level. When debug is true (or FME_ELECTRON_DEBUG is set),
// the log level is set to Debug; otherwise it defaults to Info.
func initLogger(debug bool) {
	log.SetFormatter(&log.TextFormatter{
		FullTimestamp: true,
	})

	log.SetOutput(os.Stdout)

	if debug {
		log.SetLevel(log.DebugLevel)
	} else {
		log.SetLevel(log.InfoLevel)
	}
}
