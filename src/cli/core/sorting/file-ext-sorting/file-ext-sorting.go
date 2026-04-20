package file_ext_sorting

import (
	"fmt"
	"strings"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/utils"
)

func New(extOrder []string) (*FileExtSorting, error) {
	if len(extOrder) == 0 {
		return nil, nil
	}

	if !utils.StringArrayContains(extOrder, "*") {
		extOrder = append(extOrder, "*")
	}

	for idx, ext := range extOrder {
		if ext != "*" && !strings.HasPrefix(ext, ".") {
			extOrder[idx] = fmt.Sprintf(".%s", ext)
		}

		if ext == "*" && idx < (len(extOrder)-1) {
			events.Events.Warn(strFileOrderWildCard)
			break
		}
	}

	return &FileExtSorting{
		extOrder: extOrder,
	}, nil
}
