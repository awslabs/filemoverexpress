package daemontypes

import (
	"errors"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/radovskyb/watcher"
	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/cmd/clitools"
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/core/upload/hot_folder"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/globals"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/types/daemontypes/daemonutils"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
)

const (
	exitDelayMs           = 200
	fileWatcherIntervalMs = 100
	startUpDelay          = 10 * time.Second
)

var (
	instance *FMEDaemon
	mtx      = &sync.Mutex{}
)

type (
	DaemonUpload struct {
		TransferProfile configtypes.TransferProfile
		Sources         []string
		BasePath        string
		Destination     string
		Force           bool
	}
	DaemonDownload struct {
		TransferProfile configtypes.TransferProfile
		Sources         []string
		Destination     string
		Force           bool
	}
	FMEDaemon struct {
		Signals            chan os.Signal
		watcher            *watcher.Watcher
		watchedFiles       map[string]time.Time
		maxActiveTransfers int32
		work               chan interface{}
		eventChannel       chan eventtypes.Event
	}
)

func GetInstance() FMEDaemon {
	mtx.Lock()
	defer mtx.Unlock()
	if instance == nil {
		nrd := newDaemon()
		instance = &nrd
	}

	return *instance
}

func (fmed *FMEDaemon) StartDaemonMessagesListener() {
	err := events.Events.RegisterListener("daemonMessages", fmed.eventChannel, eventtypes.AllEvents)
	if err != nil {
		events.Events.Fatal(strFailedToRegisterEventListener, err)
	}
}

func (fmed *FMEDaemon) StartDaemonGoRoutines() {
	go fmed.processFileSystemEvents()
	go fmed.signalHandler()
	go fmed.processEvents()
}

func (fmed *FMEDaemon) processFileSystemEvents() {
	for {
		err := fmed.waitForFileSystemEvents()
		if err != nil {
			return
		}
		time.Sleep(constants.SleepDuration)
	}
}

func (fmed *FMEDaemon) waitForFileSystemEvents() error {
	select {
	case evt := <-fmed.watcher.Event:
		if evt.IsDir() {
			return nil
		}

		mtx.Lock()
		fmed.watchedFiles[evt.Path] = time.Now()
		mtx.Unlock()
	case err := <-fmed.watcher.Error:
		events.Events.Fatal(err.Error())
	case <-fmed.watcher.Closed:
		return errors.New(strStoppingFileWatcher)
	}
	return nil
}

// signalHandler takes care of exiting the daemon gracefully when an interrupt or stop signal is sent to the process
func (fmed *FMEDaemon) signalHandler() {
	for {
		select {
		case sig := <-fmed.Signals:
			events.Events.Info(strReceivedShutdownSignal, sig)
			fmed.Shutdown()
		default:
			time.Sleep(constants.SleepDuration)
		}
	}
}

func (fmed *FMEDaemon) Shutdown() {
	events.Events.Shutdown(eventtypes.DaemonModeExit)
	fmed.watcher.Close()
	time.Sleep(time.Millisecond * time.Duration(exitDelayMs))
	daemonutils.DeletePidFile()
	os.Exit(0)
}

func (fmed *FMEDaemon) processEvents() {
	for {
		select {
		case evt := <-fmed.eventChannel:
			logger.SendLog(evt.Priority(), evt.String())
		default:
			time.Sleep(constants.SleepDuration)
		}
	}
}

/*
func (*FMEDaemon) printStatus() {
	last := int32(-1)
	start := time.Now()

	for {
		duration := int32(time.Since(start).Seconds())
		if duration%5 == 0 && duration != last {
			last = duration
			uplEvt := eventtypes.TotalUploadsEvent{
				ActiveTransfers:    transfer.ActiveTransfers.UploadsCount(),
				RemainingTransfers: transfer.RemainingTransfers.UploadsCount(),
				CompletedUploads:   transfer.CompletedTransfers.UploadsCount(),
			}
			events.Events.Send(&uplEvt)
		}
		time.Sleep(constants.SleepDuration)
	}
}
*/

// This should only be called by GetInstance()
func newDaemon() FMEDaemon {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM)

	w := watcher.New()
	w.FilterOps(watcher.Rename, watcher.Move, watcher.Create, watcher.Write)

	nrd := FMEDaemon{
		Signals:            sigs,
		watcher:            w,
		watchedFiles:       map[string]time.Time{},
		maxActiveTransfers: viper.GetInt32("general.max_active_transfers"),
		work:               make(chan interface{}),
		eventChannel:       make(chan eventtypes.Event),
	}

	return nrd
}

func DaemonWorker() {
	d := GetInstance()

	go clitools.RegisterEventListener("daemonMessages")
	d.StartDaemonGoRoutines()

	time.Sleep(startUpDelay)
	verifyBlockedList()
	hot_folder.InitialHotFolderUpload()

	// Start the watching process - it'll check for changes every 100ms. Blocks until the watcher is closed
	err := hot_folder.Watcher.Start(time.Millisecond * fileWatcherIntervalMs)
	if err != nil {
		events.Events.Fatal(strFailedToStartFileWatcher, err)
	}
}

// nolint:nestif
//
//revive:disable:cognitive-complexity
func verifyBlockedList() {
	for _, pathName := range globals.GetInstance().GetCfg().APIServer.BlockedPathList {
		if filepath.IsAbs(pathName) {
			symName, err := filepath.EvalSymlinks(pathName)
			if err != nil {
				events.Events.Error(strErrorEvaluatingBlockedPath, err)
			}
			if symName != pathName {
				events.Events.Debug(strBlockedPathIsSym, pathName, symName)
			}
		} else {
			if strings.Contains(pathName, string(filepath.Separator)) {
				events.Events.Fatal(strInvalidBlockPath, pathName)
			}
		}
	}
}
