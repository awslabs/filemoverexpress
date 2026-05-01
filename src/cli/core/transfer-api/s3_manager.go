package transfer_api

import (
	"context"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/sts"
	"github.com/aws/smithy-go/middleware"

	fmeconfig "github.com/awslabs/filemoverexpress/config"
)

var (
	configCache     = make(map[string]*aws.Config)
	configCacheLock = sync.RWMutex{}

	// loadConfigFunc and sessionValidatorFunc are package-level function variables
	// to allow tests to stub out AWS SDK calls without requiring real credentials.
	loadConfigFunc       = loadDefaultConfig
	sessionValidatorFunc = isSessionValid
)

type (
	S3ManagerConfig struct {
		AwsProfile string
		Bucket     string
		Region     string
		Endpoint   string
	}

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

func NewS3Manager(input S3ManagerConfig) (*S3Manager, error) {
	cfg, err := GetSession(input.AwsProfile, input.Region)
	if err != nil {
		return nil, err
	}
	retryCount := fmeconfig.LoadConfiguration().General.RetryCount
	retryCount = max(retryCount, 0)
	var client *s3.Client
	if input.Endpoint != "" {
		client = s3.NewFromConfig(*cfg, func(opts *s3.Options) {
			opts.RetryMaxAttempts = int(retryCount)
			opts.BaseEndpoint = aws.String(input.Endpoint)
		})
	} else {
		client = s3.NewFromConfig(*cfg, func(opts *s3.Options) {
			opts.RetryMaxAttempts = int(retryCount)
		})
	}
	return &S3Manager{
		Region:     input.Region,
		Bucket:     input.Bucket,
		AwsProfile: input.AwsProfile,
		Client: &FileMoverS3Client{
			client: client,
		},
		Lock: &sync.RWMutex{},
	}, nil
}
