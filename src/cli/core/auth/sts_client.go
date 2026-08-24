package auth

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sts"
)

// RealSTSClient is the production implementation of STSClient using the AWS SDK.
type RealSTSClient struct{}

// NewRealSTSClient creates a new production STS client.
func NewRealSTSClient() *RealSTSClient {
	return &RealSTSClient{}
}

// AssumeRoleWithWebIdentity calls STS to exchange a web identity token for temporary AWS credentials.
//
//nolint:revive // argument-limit: interface method signature defined in oidc_provider.go
func (*RealSTSClient) AssumeRoleWithWebIdentity(
	ctx context.Context,
	roleARN string,
	sessionName string,
	webIdentityToken string,
	durationSeconds int32,
) (*AWSCredentials, error) {
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("load AWS config for STS: %w", err)
	}

	client := sts.NewFromConfig(cfg)

	input := &sts.AssumeRoleWithWebIdentityInput{
		RoleArn:          &roleARN,
		RoleSessionName:  &sessionName,
		WebIdentityToken: &webIdentityToken,
	}
	if durationSeconds > 0 {
		dur := int32(durationSeconds)
		input.DurationSeconds = &dur
	}

	result, err := client.AssumeRoleWithWebIdentity(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("STS AssumeRoleWithWebIdentity: %w", err)
	}

	return &AWSCredentials{
		AccessKeyID:     *result.Credentials.AccessKeyId,
		SecretAccessKey: *result.Credentials.SecretAccessKey,
		SessionToken:    *result.Credentials.SessionToken,
		Expiration:      *result.Credentials.Expiration,
	}, nil
}
