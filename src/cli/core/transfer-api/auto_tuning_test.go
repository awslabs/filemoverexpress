package transfer_api

import (
	"reflect"
	"testing"

	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/awslabs/filemoverexpress/constants"
)

func Test_WithDownloadSettings(t *testing.T) {
	type fields struct {
		Downloader *manager.Downloader
		Uploader   *manager.Uploader
	}
	type args struct {
		input AutoTuningConfig
	}
	type wantConfig struct {
		PartSize    int64
		Concurrency int
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   wantConfig
	}{
		{
			name: "Uses lowest auto tune settings",
			fields: fields{
				Downloader: &manager.Downloader{
					PartSize:    0,
					Concurrency: 0,
				},
				Uploader: nil,
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  2 * constants.MiB,
					AutoTuning:  true,
					MemoryLimit: 10 * constants.GiB,
				},
			},
			want: wantConfig{
				PartSize:    15 * constants.MiB,
				Concurrency: 1,
			},
		},
		{
			name: "Uses higher auto tune settings",
			fields: fields{
				Downloader: &manager.Downloader{
					PartSize:    0,
					Concurrency: 0,
				},
				Uploader: nil,
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  1000 * constants.MiB,
					AutoTuning:  true,
					MemoryLimit: 10 * constants.GiB,
				},
			},
			want: wantConfig{
				PartSize:    10 * constants.MiB,
				Concurrency: 100,
			},
		},
		{
			name: "Memory limit too low",
			fields: fields{
				Downloader: &manager.Downloader{
					PartSize:    0,
					Concurrency: 0,
				},
				Uploader: nil,
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  10 * constants.GiB,
					AutoTuning:  true,
					MemoryLimit: 800 * constants.MiB,
				},
			},
			want: wantConfig{
				PartSize:    10 * constants.MiB,
				Concurrency: 75,
			},
		},
		{
			name: "No autotuning",
			fields: fields{
				Downloader: &manager.Downloader{
					PartSize:    100 * constants.MiB,
					Concurrency: 4,
				},
				Uploader: nil,
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  10 * constants.GiB,
					AutoTuning:  false,
					MemoryLimit: 100 * constants.MiB,
				},
			},
			want: wantConfig{
				PartSize:    100 * constants.MiB,
				Concurrency: 4,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			myFunc := WithDownloadSettings(tt.args.input)
			myFunc(tt.fields.Downloader)
			got := wantConfig{
				PartSize:    tt.fields.Downloader.PartSize,
				Concurrency: tt.fields.Downloader.Concurrency,
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("WithDownloadSettings() = %v, want %v", got, tt.want)
			}

		})
	}
}

func Test_WithUploadSettings(t *testing.T) {
	type fields struct {
		Downloader *manager.Downloader
		Uploader   *manager.Uploader
	}
	type args struct {
		input AutoTuningConfig
	}
	type wantConfig struct {
		PartSize    int64
		Concurrency int
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   wantConfig
	}{
		{
			name: "Uses lowest auto tune settings",
			fields: fields{
				Downloader: nil,
				Uploader: &manager.Uploader{
					PartSize:    0,
					Concurrency: 0,
				},
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  2 * constants.MiB,
					AutoTuning:  true,
					MemoryLimit: 10 * constants.GiB,
				},
			},
			want: wantConfig{
				PartSize:    15 * constants.MiB,
				Concurrency: 1,
			},
		},
		{
			name: "Uses higher auto tune settings",
			fields: fields{
				Downloader: nil,
				Uploader: &manager.Uploader{
					PartSize:    0,
					Concurrency: 0,
				},
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  1000 * constants.MiB,
					AutoTuning:  true,
					MemoryLimit: 10 * constants.GiB,
				},
			},
			want: wantConfig{
				PartSize:    10 * constants.MiB,
				Concurrency: 100,
			},
		},
		{
			name: "Memory limit too low",
			fields: fields{
				Downloader: nil,
				Uploader: &manager.Uploader{
					PartSize:    0,
					Concurrency: 0,
				},
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  10 * constants.GiB,
					AutoTuning:  true,
					MemoryLimit: 800 * constants.MiB,
				},
			},
			want: wantConfig{
				PartSize:    10 * constants.MiB,
				Concurrency: 75,
			},
		},
		{
			name: "No autotuning",
			fields: fields{
				Downloader: nil,
				Uploader: &manager.Uploader{
					PartSize:    100 * constants.MiB,
					Concurrency: 4,
				},
			},
			args: args{
				input: AutoTuningConfig{
					SourceSize:  10 * constants.GiB,
					AutoTuning:  false,
					MemoryLimit: 100 * constants.MiB,
				},
			},
			want: wantConfig{
				PartSize:    100 * constants.MiB,
				Concurrency: 4,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			myFunc := WithUploadSettings(tt.args.input)
			myFunc(tt.fields.Uploader)
			got := wantConfig{
				PartSize:    tt.fields.Uploader.PartSize,
				Concurrency: tt.fields.Uploader.Concurrency,
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("WithUploadSettings() = %v, want %v", got, tt.want)
			}

		})
	}
}

func Test_withExplicitUploadSettings(t *testing.T) {
	tests := []struct {
		name         string
		threads      int
		partSize     int64
		startConc    int
		startPart    int64
		wantConc     int
		wantPartSize int64
	}{
		{"sets both", 20, 32 * constants.MiB, 1, constants.MiB, 20, 32 * constants.MiB},
		{"zero threads leaves concurrency", 0, 32 * constants.MiB, 7, constants.MiB, 7, 32 * constants.MiB},
		{"zero partSize leaves part", 20, 0, 1, 10 * constants.MiB, 20, 10 * constants.MiB},
		{"both zero leaves defaults", 0, 0, 5, 9 * constants.MiB, 5, 9 * constants.MiB},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &manager.Uploader{Concurrency: tt.startConc, PartSize: tt.startPart}
			withExplicitUploadSettings(tt.threads, tt.partSize)(u)
			if u.Concurrency != tt.wantConc {
				t.Errorf("Concurrency = %d, want %d", u.Concurrency, tt.wantConc)
			}
			if u.PartSize != tt.wantPartSize {
				t.Errorf("PartSize = %d, want %d", u.PartSize, tt.wantPartSize)
			}
		})
	}
}

func Test_withExplicitDownloadSettings(t *testing.T) {
	tests := []struct {
		name         string
		threads      int
		partSize     int64
		startConc    int
		startPart    int64
		wantConc     int
		wantPartSize int64
	}{
		{"sets both", 16, 25 * constants.MiB, 1, constants.MiB, 16, 25 * constants.MiB},
		{"zero threads leaves concurrency", 0, 25 * constants.MiB, 4, constants.MiB, 4, 25 * constants.MiB},
		{"zero partSize leaves part", 16, 0, 1, 10 * constants.MiB, 16, 10 * constants.MiB},
		{"both zero leaves defaults", 0, 0, 3, 8 * constants.MiB, 3, 8 * constants.MiB},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := &manager.Downloader{Concurrency: tt.startConc, PartSize: tt.startPart}
			withExplicitDownloadSettings(tt.threads, tt.partSize)(d)
			if d.Concurrency != tt.wantConc {
				t.Errorf("Concurrency = %d, want %d", d.Concurrency, tt.wantConc)
			}
			if d.PartSize != tt.wantPartSize {
				t.Errorf("PartSize = %d, want %d", d.PartSize, tt.wantPartSize)
			}
		})
	}
}
