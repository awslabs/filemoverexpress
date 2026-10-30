package transfer_api

import (
	"context"
	"errors"
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
	"github.com/awslabs/filemoverexpress/core/auth/staticcreds"
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

	errOIDCProviderNotInitialized = errors.New("OIDC provider not initialized")
)

type (
	S3ManagerConfig struct {
		AwsProfile string
		Bucket     string
		Region     string
		Endpoint   string
	}

	// StaticCredentialsTestInput carries not-yet-stored credentials + connection context for a
	// validation-only check (see TestStaticCredentials).
	StaticCredentialsTestInput struct {
		AccessKeyID     string
		SecretAccessKey string
		SessionToken    string
		Bucket          string
		Region          string
		Endpoint        string
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

	// oidcCredentialProvider implements aws.CredentialsProvider by delegating to the
	// OIDCProvider's GetCredentials method. The AWS SDK calls Retrieve() on each API
	// request (with internal caching based on CanExpire/Expires), enabling transparent
	// credential refresh during long-running transfers.
	oidcCredentialProvider struct {
		provider    *auth.OIDCProvider
		profileName string
		oidcConfig  *auth.OIDCConfig
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
	if tp.AuthMethod == configtypes.AuthMethodAccessKey {
		return getStaticSession(tp)
	}
	// Default path: AWS_PROFILE or UNSPECIFIED — use existing credential resolution
	return GetSession(tp.Profile, tp.Region)
}

// getStaticSession builds an AWS config from the profile's stored static access key. It does NOT
// use configCache (a static profile has an empty AWS profile name, which would collide on the
// region-profile cache key), mirroring how the OIDC path builds its config directly.
func getStaticSession(tp configtypes.TransferProfile) (*aws.Config, error) {
	creds, err := staticcreds.NewManager().Vend(tp.Name)
	if err != nil {
		return nil, err
	}
	cfg, err := buildStaticConfig(tp.Region, creds.AccessKeyID, creds.SecretAccessKey, creds.SessionToken)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// buildStaticConfig creates an aws.Config backed by a static credentials provider. sessionToken is
// empty for long-lived access keys and non-empty for temporary credentials; the AWS SDK includes it
// in signing only when set.
func buildStaticConfig(region, accessKeyID, secretAccessKey, sessionToken string) (aws.Config, error) {
	return config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKeyID, secretAccessKey, sessionToken),
		),
		config.WithAPIOptions(func() (v []func(stack *middleware.Stack) error) {
			v = append(v, attachCustomMiddleware())
			return v
		}()),
	)
}

// TestStaticCredentials validates not-yet-stored static credentials by building an ephemeral S3
// client and performing a lightweight bucket check. It stores nothing. Powers the "Test connection"
// button so the user gets pass/fail before the profile is persisted.
func TestStaticCredentials(in StaticCredentialsTestInput) error {
	cfg, err := buildStaticConfig(in.Region, in.AccessKeyID, in.SecretAccessKey, in.SessionToken)
	if err != nil {
		return err
	}
	tp := configtypes.TransferProfile{Bucket: in.Bucket, Region: in.Region, Endpoint: in.Endpoint}
	s3m, err := buildS3Manager(&cfg, tp)
	if err != nil {
		return err
	}
	return s3m.ValidateCredentials()
}

func (o *oidcCredentialProvider) Retrieve(_ context.Context) (aws.Credentials, error) {
	creds, err := o.provider.GetCredentials(o.profileName, o.oidcConfig)
	if err != nil {
		return aws.Credentials{}, err
	}
	return aws.Credentials{
		AccessKeyID:     creds.AccessKeyID,
		SecretAccessKey: creds.SecretAccessKey,
		SessionToken:    creds.SessionToken,
		Source:          "OIDCProvider",
		CanExpire:       true,
		Expires:         creds.Expiration,
	}, nil
}

func getOIDCSession(tp configtypes.TransferProfile) (*aws.Config, error) {
	if oidcProvider == nil {
		return nil, errOIDCProviderNotInitialized
	}

	oidcCfg := mapTransferProfileToOIDCConfig(tp.OIDCConfig)

	// Fail fast: verify credentials are obtainable before building the client.
	// This surfaces ErrOIDCNotAuthenticated immediately rather than on first S3 call.
	if _, err := oidcProvider.GetCredentials(tp.Name, oidcCfg); err != nil {
		return nil, err
	}

	provider := &oidcCredentialProvider{
		provider:    oidcProvider,
		profileName: tp.Name,
		oidcConfig:  oidcCfg,
	}

	cfg, err := buildOIDCConfig(tp.Region, provider)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}

// mapTransferProfileToOIDCConfig converts the config types to the auth package types.
func mapTransferProfileToOIDCConfig(src *configtypes.OIDCConfig) *auth.OIDCConfig {
	if src == nil {
		return nil
	}
	return &auth.OIDCConfig{
		IssuerURL:              src.IssuerURL,
		ClientID:               src.ClientID,
		RoleARN:                src.RoleARN,
		Scopes:                 src.Scopes,
		PersistSession:         src.PersistSession,
		CustomCABundle:         src.CustomCABundle,
		SessionDurationSeconds: src.SessionDurationSeconds,
	}
}

func buildOIDCConfig(region string, provider aws.CredentialsProvider) (aws.Config, error) {
	return config.LoadDefaultConfig(
		context.TODO(),
		config.WithRegion(region),
		config.WithCredentialsProvider(provider),
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
			// S3-compatible stores (MinIO, etc.) addressed via a custom endpoint generally require
			// path-style addressing; AWS S3 (no custom endpoint) keeps the default virtual-hosted style.
			opts.UsePathStyle = true
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
