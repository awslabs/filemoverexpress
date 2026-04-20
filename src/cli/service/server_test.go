package service

import (
	"testing"
)

func TestNewService_Executes(t *testing.T) {
	NewService("127.0.0.1", []uint{50006}, false)
}
