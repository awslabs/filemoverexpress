package transfer

const (
	Upload   Direction = "upload"
	Download Direction = "download"
)

type (
	Direction string
	Status    string
	Info      struct {
		Completed   bool
		Direction   Direction
		Destination string
		Source      string
	}
)

// NewTransferInfo is a helper function that creates Info objects
func NewTransferInfo(direction Direction, destination string, source string) Info {
	return Info{
		Completed:   false,
		Direction:   direction,
		Destination: destination,
		Source:      source,
	}
}
