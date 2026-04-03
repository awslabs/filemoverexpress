package object_already_exists

import (
    "testing"

    "github.com/awslabs/filemoverexpress/constants"
    transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
    "github.com/awslabs/filemoverexpress/types/configtypes"
)

func TestNewObjectAlreadyExistsFilter(t *testing.T) {
    type args struct {
        s3m       *transferapi.S3Manager
        checksums configtypes.ChecksumSettings
    }
    tests := []struct {
        name    string
        args    args
        wantErr bool
    }{
        {
            name: "NewFileAlreadyExistsFilter should return a valid instance",
            args: args{
                s3m: &transferapi.S3Manager{
                    AwsProfile: "",
                    Bucket:     "",
                    Client:     nil,
                    Downloader: nil,
                    Region:     "",
                    Uploader:   nil,
                    Lock:       nil,
                },
                checksums: configtypes.ChecksumSettings{
                    Enabled:   false,
                    Algorithm: constants.AlgorithmNone,
                },
            },
            wantErr: false,
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := NewObjectAlreadyExistsFilter(tt.args.s3m, tt.args.checksums)
            if (err != nil) != tt.wantErr {
                t.Errorf("NewObjectAlreadyExistsFilter() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
        })
    }
}

func TestObjectAlreadyExistsFilter_FilteredReason(t *testing.T) {
    type fields struct {
        s3m *transferapi.S3Manager
    }
    tests := []struct {
        name   string
        fields fields
        want   string
    }{
        {
            name: "FilteredReason() should return expected string",
            fields: fields{
                s3m: &transferapi.S3Manager{
                    AwsProfile: "",
                    Bucket:     "",
                    Client:     nil,
                    Downloader: nil,
                    Region:     "",
                    Uploader:   nil,
                    Lock:       nil,
                },
            },
            want: "Object already exists",
        },
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ob := &ObjectAlreadyExistsFilter{
                s3m: tt.fields.s3m,
            }
            if got := ob.FilteredReason(); got != tt.want {
                t.Errorf("FilteredReason() = %v, want %v", got, tt.want)
            }
        })
    }
}

//func TestObjectAlreadyExistsFilter_IsFiltered(t *testing.T) {
//	type fields struct {
//		profile    string
//		bucket     string
//		cfg        *aws.Config
//		filterType pbtypes.SkippedState
//	}
//	type args struct {
//		taskInput *jobmanagertypes.task
//	}
//	tests := []struct {
//		name    string
//		fields  fields
//		args    args
//		want    bool
//		wantErr bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			oaef := &ObjectAlreadyExistsFilter{
//				profile:    tt.fields.profile,
//				bucket:     tt.fields.bucket,
//				cfg:        tt.fields.cfg,
//				filterType: tt.fields.filterType,
//			}
//			got, err := oaef.IsFiltered(tt.args.taskInput)
//			if (err != nil) != tt.wantErr {
//				t.Errorf("IsFiltered() error = %v, wantErr %v", err, tt.wantErr)
//				return
//			}
//			if got != tt.want {
//				t.Errorf("IsFiltered() got = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}

//func TestObjectAlreadyExistsFilter_SkipType(t *testing.T) {
//	type fields struct {
//		profile    string
//		bucket     string
//		cfg        *aws.Config
//		filterType pbtypes.SkippedState
//	}
//	tests := []struct {
//		name   string
//		fields fields
//		want   pbtypes.SkippedState
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			oaef := &ObjectAlreadyExistsFilter{
//				profile:    tt.fields.profile,
//				bucket:     tt.fields.bucket,
//				cfg:        tt.fields.cfg,
//				filterType: tt.fields.filterType,
//			}
//			if got := oaef.SkipType(); got != tt.want {
//				t.Errorf("SkipType() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_checksumsMatch(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//		result   *s3.HeadObjectOutput
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := checksumsMatch(tt.args.metadata, tt.args.source, tt.args.result); got != tt.want {
//				t.Errorf("checksumsMatch() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasChecksumMatch(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasChecksumMatch(tt.args.metadata, tt.args.source); got != tt.want {
//				t.Errorf("hasChecksumMatch() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasMd5(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasMd5(tt.args.metadata, tt.args.source); got != tt.want {
//				t.Errorf("hasMd5() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasSizeMatch(t *testing.T) {
//	type args struct {
//		source *jobmanagertypes.task
//		result *s3.HeadObjectOutput
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasSizeMatch(tt.args.source, tt.args.result); got != tt.want {
//				t.Errorf("hasSizeMatch() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasXxh3(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasXxh3(tt.args.metadata, tt.args.source); got != tt.want {
//				t.Errorf("hasXxh3() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasXxhash(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasXxhash(tt.args.metadata, tt.args.source); got != tt.want {
//				t.Errorf("hasXxhash() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
//
//func Test_hasXxhash64(t *testing.T) {
//	type args struct {
//		metadata map[string]string
//		source   *jobmanagertypes.task
//	}
//	tests := []struct {
//		name string
//		args args
//		want bool
//	}{
//		// TODO: Add test cases.
//	}
//	for _, tt := range tests {
//		t.Run(tt.name, func(t *testing.T) {
//			if got := hasXxhash64(tt.args.metadata, tt.args.source); got != tt.want {
//				t.Errorf("hasXxhash64() = %v, want %v", got, tt.want)
//			}
//		})
//	}
//}
