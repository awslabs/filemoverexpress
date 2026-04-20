package discovery

import "github.com/awslabs/filemoverexpress/types/jobmanagertypes"

type FileMoveDiscovery interface {
	Discover(paths []string) (*[]jobmanagertypes.Task, []error)
}
