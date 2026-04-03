package file_ext_sorting

import (
    "os"
    "testing"

    "github.com/awslabs/filemoverexpress/core/discovery/local_discovery"
    "github.com/awslabs/filemoverexpress/types/jobmanagertypes"
)

var (
    ld = local_discovery.NewLocalDiscovery("", "random-id", "")
)

func TestFileExtSorting_Sort(t *testing.T) {
    type (
        fields struct {
            extOrder []string
            output   []*jobmanagertypes.Task
            filtered map[string]bool
        }

        args struct {
            tasks []*jobmanagertypes.Task
        }
    )

    tasks, tasksErr := getTasks()
    if tasksErr != nil {
        t.Errorf("Failed building tasks list for sorting tests")
        return
    }

    tests := []struct {
        name    string
        fields  fields
        args    args
        want    []string
        wantErr bool
    }{
        {
            name: "Test sorting list",
            fields: fields{
                extOrder: []string{".mov", ".wav", "*"},
                output:   make([]*jobmanagertypes.Task, 0),
                filtered: make(map[string]bool),
            },
            args: args{
                tasks: tasks,
            },
            want: []string{
                "testdata/sorting/clip.mov",
                "testdata/sorting/frame.mov",
                "testdata/sorting/clip.wav",
                "testdata/sorting/frame.wav",
                "testdata/sorting/aaa.txt",
            },
            wantErr: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            fes := &FileExtSorting{
                extOrder: tt.fields.extOrder,
                output:   tt.fields.output,
                filtered: tt.fields.filtered,
            }

            got, err := fes.Sort(tt.args.tasks)
            if (err != nil) != tt.wantErr {
                t.Errorf("Sort() error = %v, wantErr %v", err, tt.wantErr)
                return
            }

            if len(got) != len(tt.want) {
                t.Errorf("Expected output to be same length as input, got %d, expected %d", len(got), len(tt.want))
                return
            }

            for idx, expected := range tt.want {
                if got[idx].LocalFile().Path != expected {
                    t.Errorf("Expected %s to be at index %d but %s was found instead", expected, idx, got[idx].LocalFile().Path)
                    return
                }
            }
        })
    }
}

func getTasks() ([]*jobmanagertypes.Task, error) {
    err := os.Chdir("../../../")
    if err != nil {
        return nil, err
    }

    tasks, discoveryErrors := ld.Discover([]string{"testdata/sorting"})
    if discoveryErrors != nil {
        for _, err := range discoveryErrors {
            return nil, err
        }
    }

    return tasks, nil
}
