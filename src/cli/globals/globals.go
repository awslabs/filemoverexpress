package globals

import (
	"sync/atomic"

	"github.com/spf13/viper"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/configtypes"
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

var (
	instance       *FmeGlobals
	cfgInitialized bool
)

type FmeGlobals struct {
	version    string
	daemonMode bool
	cfg        atomic.Value
	machineId  string
}

func GetInstance() *FmeGlobals {
	if instance == nil {
		instance = &FmeGlobals{
			version:    "",
			daemonMode: false,
			machineId:  systeminfo.GetMachineID(),
		}
	}

	return instance
}

func (nrg *FmeGlobals) SetVersion(version string) {
	nrg.version = version
}

func (nrg *FmeGlobals) GetVersion() string {
	return nrg.version
}

func (nrg *FmeGlobals) SetDaemonMode(daemonMode bool) {
	nrg.daemonMode = daemonMode
}

func (nrg *FmeGlobals) GetDaemonMode() bool {
	return nrg.daemonMode
}

func (nrg *FmeGlobals) GetMachineId() string {
	return nrg.machineId
}

func (nrg *FmeGlobals) GetCfg() (cfg configtypes.FmeConfig) {
	if !cfgInitialized {
		cfg, err := config.LoadConfiguration()
		if err != nil {
			logger.Fatal(strFailedLoadingConfig, err)
		}
		cfgInitialized = true
		nrg.cfg.Store(cfg)
	}
	cfg = nrg.cfg.Load().(configtypes.FmeConfig)
	return cfg
}

func (nrg *FmeGlobals) ReloadCfg() {
	configtypes.ViperLock.Lock()
	viper.Reset()
	config.InitConfig()
	configtypes.ViperLock.Unlock()
	cfg, err := config.LoadConfiguration()
	if err != nil {
		events.Events.Fatal(strFailedLoadingConfig, err)
	}
	nrg.cfg.Store(cfg)
}
