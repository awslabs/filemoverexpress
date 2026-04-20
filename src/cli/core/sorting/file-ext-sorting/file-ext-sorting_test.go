package file_ext_sorting

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/logger"
	"github.com/awslabs/filemoverexpress/types/eventtypes"
)

func TestNew(t *testing.T) {
	type args struct {
		extOrder []string
	}

	tests := []struct {
		name          string
		args          args
		want          []string
		wantNil       bool
		wantErr       bool
		expectedError error
	}{
		{
			name: "Create sorter without wildcard",
			args: args{
				extOrder: []string{".mov", ".wav"},
			},
			want:          []string{".mov", ".wav", "*"},
			wantErr:       false,
			wantNil:       false,
			expectedError: nil,
		},
		{
			name: "Create sorter with wildcard",
			args: args{
				extOrder: []string{".mov", ".wav", "*"},
			},
			want:          []string{".mov", ".wav", "*"},
			wantErr:       false,
			wantNil:       false,
			expectedError: nil,
		},
		{
			name: "Create sorter without dots",
			args: args{
				extOrder: []string{"mov", "wav", "*"},
			},
			want:          []string{".mov", ".wav", "*"},
			wantErr:       false,
			wantNil:       false,
			expectedError: nil,
		},
		{
			name: "Create sorter with empty list",
			args: args{
				extOrder: []string{},
			},
			want:          []string{},
			wantErr:       false,
			wantNil:       true,
			expectedError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := New(tt.args.extOrder)

			if (err != nil) != tt.wantErr {
				t.Errorf("New() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if (got == nil) != tt.wantNil {
				t.Errorf("New() wantNil = %v, got %v", tt.wantNil, got)
				return
			}

			if !tt.wantErr && !tt.wantNil {
				if len(got.extOrder) != len(tt.want) {
					t.Errorf("Expected %d items in file extension list, but found %d", len(tt.want), len(got.extOrder))
					return
				}

				for idx, ext := range tt.want {
					if got.extOrder[idx] != ext {
						t.Errorf("Expected extension %s but got %s at index %d", ext, got.extOrder[idx], idx)
					}
				}
			} else {
				if tt.wantErr && !errors.Is(err, tt.expectedError) {
					t.Errorf("Unexpected error received: %s", err)
				}
			}
		})
	}
}

func TestNew_WildcardInMiddle(t *testing.T) {
	wg := sync.WaitGroup{}
	wg.Add(1)
	eventsChannel := make(chan eventtypes.Event, 10)

	if err := events.Events.RegisterListener("TestNew_WildcardInMiddle", eventsChannel, eventtypes.MessageEventType); err != nil {
		t.Errorf("Failed to register events listener: %s", err)
		return
	}

	defer func() {
		if err := events.Events.RemoveListener("TestNew_WildcardInMiddle"); err != nil {
			t.Errorf("Failed removing events listener: %s", err)
		}
	}()

	go func() {
		for evt := range eventsChannel {
			if evt.Type() == eventtypes.MessageEventType {
				msgEvt := evt.(*eventtypes.MessageEvent)
				if msgEvt.Priority() == logger.WarnLevel && msgEvt.Msg == strFileOrderWildCard {
					wg.Done()
					return
				}
			}
		}
	}()
	time.Sleep(time.Second)

	if _, err := New([]string{".txt", "*", ".mov"}); err != nil {
		t.Errorf("Unable to create sorter: %s", err)
		return
	}

	wg.Wait()
}
