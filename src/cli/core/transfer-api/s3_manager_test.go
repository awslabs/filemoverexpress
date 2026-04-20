package transfer_api

import (
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/awslabs/filemoverexpress/core/transfer-api/mock"
)

// stubLoadConfig returns a minimal aws.Config without hitting real AWS config files.
func stubLoadConfig(profile string, region string) (aws.Config, error) {
	return aws.Config{
		Region: region,
	}, nil
}

// stubSessionValidator always returns true so tests don't make real STS calls.
func stubSessionValidator(_ aws.Config) bool {
	return true
}

func TestGetSession(t *testing.T) {
	// Swap in stubs and restore originals after the test.
	origLoad := loadConfigFunc
	origValidator := sessionValidatorFunc
	t.Cleanup(func() {
		loadConfigFunc = origLoad
		sessionValidatorFunc = origValidator
		// Clear the cache so other tests start fresh.
		configCacheLock.Lock()
		configCache = make(map[string]*aws.Config)
		configCacheLock.Unlock()
	})
	loadConfigFunc = stubLoadConfig
	sessionValidatorFunc = stubSessionValidator

	type args struct {
		profile string
		region  string
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Session should be created",
			args: args{
				profile: mock.UniteTestMockAWSProfile,
				region:  mock.UnitTestMockRegion,
			},
			wantErr: false,
		},
		{
			name: "Session should already exist",
			args: args{
				profile: mock.UniteTestMockAWSProfile,
				region:  mock.UnitTestMockRegion,
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg, err := GetSession(tt.args.profile, tt.args.region)
			if (err != nil) != tt.wantErr {
				t.Errorf("GetSession() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err == nil && cfg.Region != tt.args.region {
				t.Errorf("GetSession() region = %v, want %v", cfg.Region, tt.args.region)
			}
		})
	}
}

func TestNewS3Manager(t *testing.T) {
	// Swap in stubs and restore originals after the test.
	origLoad := loadConfigFunc
	origValidator := sessionValidatorFunc
	t.Cleanup(func() {
		loadConfigFunc = origLoad
		sessionValidatorFunc = origValidator
		configCacheLock.Lock()
		configCache = make(map[string]*aws.Config)
		configCacheLock.Unlock()
	})
	loadConfigFunc = stubLoadConfig
	sessionValidatorFunc = stubSessionValidator

	type args struct {
		input S3ManagerConfig
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Create S3 manager",
			args: args{
				input: S3ManagerConfig{
					AwsProfile: mock.UniteTestMockAWSProfile,
					Bucket:     mock.UnitTestMockBucket,
					Region:     mock.UnitTestMockRegion,
					Endpoint:   mock.UnitTestMockEndpoint,
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewS3Manager(tt.args.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewS3Manager() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}
