//go:build e2e

package e2e

import (
	"net/http"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
	s3sharedv1 "github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
)

func TestDaemonServesItsConfiguration(t *testing.T) {
	newTestEnv(t)

	resp, err := shared.d.Client.GetConfiguration(ctx(), connect.NewRequest(&fmev1.GetConfigurationRequest{}))

	require.NoError(t, err)
	profiles := resp.Msg.GetProtocols().GetS3().GetTransferProfiles()
	for _, name := range []string{profileDefault, profileNoChecksum, profileXXH3, profileMissingBucket} {
		assert.Contains(t, profiles, name)
	}
	assert.Equal(t, shared.em.Endpoint, profiles[profileDefault].GetEndpoint())
}

func TestRequestsWithoutAnAllowedOriginAreRejected(t *testing.T) {
	newTestEnv(t)
	plain := fmev1connect.NewFmeServiceClient(http.DefaultClient, daemonURL)

	_, err := plain.GetConfiguration(ctx(), connect.NewRequest(&fmev1.GetConfigurationRequest{}))

	require.Error(t, err)
	assert.Equal(t, connect.CodeFailedPrecondition, connect.CodeOf(err))
	assert.Contains(t, err.Error(), "access denied")
}

func TestRequestsFromAnUnknownOriginAreRejected(t *testing.T) {
	newTestEnv(t)
	req := connect.NewRequest(&fmev1.GetConfigurationRequest{})
	req.Header().Set("Origin", "http://attacker.example")

	_, err := fmev1connect.NewFmeServiceClient(http.DefaultClient, daemonURL).GetConfiguration(ctx(), req)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "access denied")
}

func TestListS3Prefix(t *testing.T) {
	env := newTestEnv(t)
	env.put("top.txt", []byte("top"))
	env.put("dir/inner.txt", []byte("inner"))

	resp, err := env.d.Client.S3ListPrefix(ctx(), connect.NewRequest(&s3sharedv1.S3ListPrefixRequest{
		TransferProfile: profileDefault, Prefix: env.prefix,
	}))

	require.NoError(t, err)
	assert.Equal(t, []string{env.key("dir/")}, resp.Msg.Prefixes)
	require.Len(t, resp.Msg.Objects, 1)
	assert.Equal(t, env.key("top.txt"), resp.Msg.Objects[0].Key)
}

func TestCreateAndDeleteS3Prefix(t *testing.T) {
	env := newTestEnv(t)
	c := env.d.Client

	created, err := c.CreateS3Prefix(ctx(), connect.NewRequest(&s3sharedv1.CreateS3PrefixRequest{
		TransferProfile: profileDefault, PrefixKey: env.key("made/"),
	}))
	require.NoError(t, err)
	require.True(t, created.Msg.Success, created.Msg.Message)
	require.True(t, env.exists("made/"))

	env.put("made/file.txt", []byte("x"))
	deleted, err := c.DeleteS3Path(ctx(), connect.NewRequest(&s3sharedv1.DeleteS3PathRequest{
		TransferProfile: profileDefault, PathToDelete: env.key("made/"), PathType: "prefix",
	}))
	require.NoError(t, err)
	require.True(t, deleted.Msg.Success, deleted.Msg.Message)
	assert.Empty(t, env.keys())
}

func TestDeleteS3Object(t *testing.T) {
	env := newTestEnv(t)
	env.put("gone.txt", []byte("bye"))
	env.put("kept.txt", []byte("stay"))

	deleted, err := env.d.Client.DeleteS3Path(ctx(), connect.NewRequest(&s3sharedv1.DeleteS3PathRequest{
		TransferProfile: profileDefault, PathToDelete: env.key("gone.txt"), PathType: "file",
	}))

	require.NoError(t, err)
	require.True(t, deleted.Msg.Success, deleted.Msg.Message)
	assert.Equal(t, []string{"kept.txt"}, env.keys())
}
