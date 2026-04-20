package eventtypes

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
)

func TestConfigurationUpdateEvent_String(t *testing.T) {
	evt := ConfigurationUpdateEvent{}

	expected := "Configuration updated"
	res := evt.String()
	if res != expected {
		t.Errorf("TestConfigurationUpdateEvent_String failed, expected '%s', but got '%s'", expected, res)
	}
}

func TestConfigurationUpdateEvent_Priority(t *testing.T) {
	evt := ConfigurationUpdateEvent{}

	res := evt.Priority()
	if res != ConfigurationUpdateEventPriority {
		t.Errorf(
			"TestConfigurationUpdateEvent_Priority failed, expected '%s', but got '%s'",
			ConfigurationUpdateEventPriority,
			res,
		)
	}
}

func TestConfigurationUpdateEvent_Type(t *testing.T) {
	evt := ConfigurationUpdateEvent{}

	res := evt.Type()
	if res != ConfigurationUpdateEventType {
		t.Errorf(
			"TestConfigurationUpdateEvent_Type failed, expected '%d', but got '%d'",
			ConfigurationUpdateEventType,
			res,
		)
	}
}

func TestConfigurationUpdateEvent_ToProtobuf(t *testing.T) {
	evt := ConfigurationUpdateEvent{}

	pbEvt, pbEvtType := evt.ToProtobuf()

	assert.Equal(t, fmev1.EventType_EVENT_TYPE_CONFIGURATION_UPDATE_EVENT_TYPE, pbEvtType)
	assert.IsType(t, &fmev1.ListEventsResponse_ConfigurationUpdateEvent{}, pbEvt)
}
