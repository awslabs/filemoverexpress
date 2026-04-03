package eventtypes

import "testing"

func TestMessageEvent_String(t *testing.T) {
    ts := "Hello world"
    evt := MessageEvent{
        Msg: ts,
    }

    if evt.String() != ts {
        t.Errorf("TestMessageEvent_String failed, expected '%s', but got '%s'", ts, evt.String())
    }
}

func TestMessageEvent_Type(t *testing.T) {
    evt := MessageEvent{
        Msg: "Hello world",
    }

    if evt.Type() != MessageEventType {
        t.Errorf("TestMessageEvent_Type failed, expected '%d', but got '%d'", MessageEventType, evt.Type())
    }
}
