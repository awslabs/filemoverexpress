package types

type ServiceConfig struct {
    Host         string
    Ports        []uint
    Remote       bool
    PreSharedKey string
}
