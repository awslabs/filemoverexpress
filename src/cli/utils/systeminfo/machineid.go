package systeminfo

import (
    "github.com/denisbrodbeck/machineid"

    "github.com/awslabs/filemoverexpress/constants"
    "github.com/awslabs/filemoverexpress/events"
)

func GetMachineID() string {
    id, err := machineid.ProtectedID(constants.ProductCLIName)
    if err != nil {
        events.Events.Warn(strFailedRetrievingMachineId, err.Error())
        return ""
    }

    return id
}
