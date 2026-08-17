package transfer_api

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go/middleware"

	fmeconfig "github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

var (
	configCache     = make(map[string]*aws.Config)
	configCacheLock = sync.RWMutex{}

	// loadConfigFunc and sessionValidatorFunc are package-level function variables
	// to allow tests to stub out AWS SDK calls without requiring real credentials.
	loadConfigFunc       = loadDefaultConfig
	sessionValidatorFunc = isSessionValid

	// oidcProvider is the package-level OIDC provider instance, set during daemon initialization.
	oidcProvider *auth.OIDCProvider

	errOIDCProviderNotInitialized = fmt.Errorf("OIDC provider not initialized")
)

type (
	S3ManagerConfig struct {
		AwsProfile string
		Bucket     string
		Region     string
		Endpoint   string
	}

	//nolint:staticcheck // Pending TransferManagerV2 migration
	S3Manager struct {
		AwsProfile string
		Bucket     string
		Client     FileMoverS3ClientInterface
		Downloader *manager.Downloader
		Region     string
		Uploader   *manager.Uploader
		Lock       *sync.RWMutex
	}
)

// SetOIDCProvider sets the package-level OIDC provider used for OIDC-authenticated sessions.
func SetOIDCProvider(provider *auth.OIDCProvider) {
	oidcProvider = provider
}

func isSessionValid(awsConfig aws.Config) bool {
	client := sts.NewFromConfig(awsConfig)
	_, err := client.GetCallerIdentity(context.TODO(), &sts.GetCallerIdentityInput{})
	return err == nil
}

// ValidateCredentials uses the S3 client to make a listObjectsV2 call to check if the credentials are valid. Returns an error if the
// credentials are invalid or if the user does not have permission to call ListObjectsV2.
func (s3m *S3Manager) ValidateCredentials() error {
	maxKeys := int32(1)
	params := &s3.ListObjectsV2Input{
		Bucket:  &s3m.Bucket,
		Prefix:  aws.String("/"),
		MaxKeys: &maxKeys,
	}
	_, err := s3m.Client.ListObjectsV2(context.TODO(), params)
	return err
}

func loadDefaultConfig(profile string, region string) (aws.Config, error) {
	return config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(region),
		config.WithSharedConfigProfile(profile),
		config.WithAPIOptions(func() (v []func(stack *middleware.Stack) error) {
			v = append(v, attachCustomMiddleware())
			return v
		}()),
	)
}

func GetSession(profile string, region string) (*aws.Config, error) {
	key := strings.Join([]string{region, profile}, "-")

	configCacheLock.RLock()
	existingCfg, entryExists := configCache[key]
	configCacheLock.RUnlock()

	if !entryExists || !sessionValidatorFunc(*existingCfg) {
		cfg, err := loadConfigFunc(profile, region)
		if err != nil {
			return nil, err
		}
		configCacheLock.Lock()
		configCache[key] = &cfg
		configCacheLock.Unlock()
	}

	configCacheLock.RLock()
	defer configCacheLock.RUnlock()
	return configCache[key], nil
}

// GetSessionForTransferProfile resolves an AWS config for the given transfer profile,
// routing to OIDC credential provider when auth_method is OIDC.
func GetSessionForTransferProfile(tp configtypes.TransferProfile) (*aws.Config, error) {
	if tp.AuthMethod == configtypes.AuthMethodOIDC {
		return getOIDCSession(tp)
	}
	// Default path: AWS_PROFILE or UNSPECIFIED — use existing credential resolution
	return GetSession(tp.Profile, tp.Region)
}

func getOIDCSession(tp configtypes.TransferProfile) (*aws.Config, error) {
	if oidcProvider == nil {
		return nil, errOIDCProviderNotInitialized
	}

	creds, err := oidcProvider.GetCredentials(tp.Name)
	if err != nil {
		return nil, err
	}

	// Use profile name as cache key (not region+awsProfile) for OIDC sessions
	key := "oidc-" + tp.Name

	configCacheLock.RLock()
	existingCfg, entryExists := configCache[key]
	configCacheLock.RUnlock()

	if entryExists && existingCfg != nil {
		// Update credentials in place via a new config with fresh static creds
		cfg, err := buildOIDCConfig(tp.Region, creds)
		if err != nil {
			return nil, err
		}
		configCacheLock.Lock()
		configCache[key] = &cfg
		configCacheLock.Unlock()
		return &cfg, nil
	}

	cfg, err := buildOIDCConfig(tp.Region, creds)
	if err != nil {
		return nil, err
	}

	configCacheLock.Lock()
	configCache[key] = &cfg
	configCacheLock.Unlock()

	return &cfg, nil
}

func buildOIDCConfig(region string, creds *auth.AWSCredentials) (aws.Config, error) {
	return config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			creds.AccessKeyID, creds.SecretAccessKey, creds.SessionToken,
		)),
	)
}

// NewS3Manager creates an S3Manager using the credential path appropriate for the transfer profile's auth method.
// For OIDC profiles, credentials are obtained from the OIDC provider; for AWS profile-based auth, standard credential
// resolution is used.
func NewS3Manager(tp configtypes.TransferProfile) (*S3Manager, error) {
	cfg, err := GetSessionForTransferProfile(tp)
	if err != nil {
		return nil, err
	}
	return buildS3Manager(cfg, tp)
}

// NewS3ManagerFromConfig creates an S3Manager using explicit AWS profile credentials.
// Use this only when a full TransferProfile is not available (e.g., CLI commands with manual args).
func NewS3ManagerFromConfig(input S3ManagerConfig) (*S3Manager, error) {
	cfg, err := GetSession(input.AwsProfile, input.Region)
	if err != nil {
		return nil, err
	}
	tp := configtypes.TransferProfile{
		Profile:  input.AwsProfile,
		Bucket:   input.Bucket,
		Region:   input.Region,
		Endpoint: input.Endpoint,
	}
	return buildS3Manager(cfg, tp)
}

func buildS3Manager(cfg *aws.Config, tp configtypes.TransferProfile) (*S3Manager, error) {
	retryCount := fmeconfig.LoadConfiguration().General.RetryCount
	retryCount = max(retryCount, 0)
	var client *s3.Client
	if tp.Endpoint != "" {
		client = s3.NewFromConfig(*cfg, func(opts *s3.Options) {
			opts.RetryMaxAttempts = int(retryCount)
			opts.BaseEndpoint = aws.String(tp.Endpoint)
		})
	} else {
		client = s3.NewFromConfig(*cfg, func(opts *s3.Options) {
			opts.RetryMaxAttempts = int(retryCount)
		})
	}
	return &S3Manager{
		Region:     tp.Region,
		Bucket:     tp.Bucket,
		AwsProfile: tp.Profile,
		Client: &FileMoverS3Client{
			client: client,
		},
		Lock: &sync.RWMutex{},
	}, nil
}
