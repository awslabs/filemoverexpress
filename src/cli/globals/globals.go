package globals

import (
	"github.com/awslabs/filemoverexpress/utils/systeminfo"
)

var (
	instance *FmeGlobals
)

type FmeGlobals struct {
	version    string
	daemonMode bool
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
