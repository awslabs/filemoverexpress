package transfer_api

import (
	"context"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"

	"github.com/awslabs/filemoverexpress/core/auth"
	"github.com/awslabs/filemoverexpress/core/transfer-api/mock"
	"github.com/awslabs/filemoverexpress/types/configtypes"
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
			_, err := NewS3ManagerFromConfig(tt.args.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewS3ManagerFromConfig() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
		})
	}
}


func TestGetSessionForTransferProfile_AWSProfile(t *testing.T) {
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

	tp := configtypes.TransferProfile{
		Name:       "aws-profile-test",
		Profile:    mock.UniteTestMockAWSProfile,
		Region:     mock.UnitTestMockRegion,
		AuthMethod: configtypes.AuthMethodAWSProfile,
	}

	cfg, err := GetSessionForTransferProfile(tp)
	if err != nil {
		t.Fatalf("GetSessionForTransferProfile() error = %v", err)
	}
	if cfg.Region != mock.UnitTestMockRegion {
		t.Errorf("GetSessionForTransferProfile() region = %v, want %v", cfg.Region, mock.UnitTestMockRegion)
	}
}

func TestGetSessionForTransferProfile_Unspecified_UsesAWSPath(t *testing.T) {
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

	tp := configtypes.TransferProfile{
		Name:       "unspecified-test",
		Profile:    mock.UniteTestMockAWSProfile,
		Region:     mock.UnitTestMockRegion,
		AuthMethod: configtypes.AuthMethodUnspecified,
	}

	cfg, err := GetSessionForTransferProfile(tp)
	if err != nil {
		t.Fatalf("GetSessionForTransferProfile() error = %v", err)
	}
	if cfg.Region != mock.UnitTestMockRegion {
		t.Errorf("GetSessionForTransferProfile() region = %v, want %v", cfg.Region, mock.UnitTestMockRegion)
	}
}

func TestGetSessionForTransferProfile_OIDC_NoProvider(t *testing.T) {
	origProvider := oidcProvider
	t.Cleanup(func() {
		oidcProvider = origProvider
	})
	oidcProvider = nil

	tp := configtypes.TransferProfile{
		Name:       "oidc-no-provider",
		Region:     mock.UnitTestMockRegion,
		AuthMethod: configtypes.AuthMethodOIDC,
	}

	_, err := GetSessionForTransferProfile(tp)
	if err == nil {
		t.Fatal("GetSessionForTransferProfile() expected error for nil OIDC provider")
	}
	if err.Error() != "OIDC provider not initialized" {
		t.Errorf("GetSessionForTransferProfile() error = %v, want 'OIDC provider not initialized'", err)
	}
}

func TestGetSessionForTransferProfile_OIDC_WithProvider(t *testing.T) {
	origProvider := oidcProvider
	origLoad := loadConfigFunc
	origValidator := sessionValidatorFunc
	t.Cleanup(func() {
		oidcProvider = origProvider
		loadConfigFunc = origLoad
		sessionValidatorFunc = origValidator
		configCacheLock.Lock()
		configCache = make(map[string]*aws.Config)
		configCacheLock.Unlock()
	})
	loadConfigFunc = stubLoadConfig
	sessionValidatorFunc = stubSessionValidator

	// Create a real OIDCProvider and manually inject an authenticated session
	provider := auth.NewOIDCProvider(t.TempDir(), &testSTSClient{})
	SetOIDCProvider(provider)

	// We need the provider to have credentials for this profile.
	// Since we can't easily run the full OIDC flow in a unit test,
	// we test the error path when not authenticated.
	tp := configtypes.TransferProfile{
		Name:       "oidc-test-profile",
		Region:     mock.UnitTestMockRegion,
		AuthMethod: configtypes.AuthMethodOIDC,
	}

	_, err := GetSessionForTransferProfile(tp)
	// Should fail because the provider has no authenticated session for this profile
	if err == nil {
		t.Fatal("GetSessionForTransferProfile() expected error for unauthenticated OIDC profile")
	}
}

// testSTSClient is a minimal STS mock for the S3Manager tests.
type testSTSClient struct{}

func (*testSTSClient) AssumeRoleWithWebIdentity(
	_ context.Context,
	_ string,
	_ string,
	_ string,
	_ int32,
) (*auth.AWSCredentials, error) {
	return &auth.AWSCredentials{
		AccessKeyID:    "AKIATEST",
		SecretAccessKey: "secret",
		SessionToken:   "token",
	}, nil
}
