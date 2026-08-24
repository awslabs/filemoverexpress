package service

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/awslabs/filemoverexpress/config"
	"github.com/awslabs/filemoverexpress/core/auth"
	transferapi "github.com/awslabs/filemoverexpress/core/transfer-api"
	"github.com/awslabs/filemoverexpress/events"
	"github.com/awslabs/filemoverexpress/types/pbtypes/s3_shared/v1"
	"github.com/awslabs/filemoverexpress/utils"
)

func (*FileMoverServer) S3ListPrefix(
	_ context.Context,
	req *connect.Request[s3_sharedv1.S3ListPrefixRequest],
) (*connect.Response[s3_sharedv1.S3ListPrefixResponse], error) {
	var objects []*s3_sharedv1.S3Object
	var folders []string

	transferProfile, err := config.LoadConfiguration().GetTransferProfile(req.Msg.GetTransferProfile())
	if err != nil {
		return nil, err
	}

	s3m, err := transferapi.NewS3Manager(transferProfile)
	if err != nil {
		events.Events.Error(
			"Failed to establish AWS session for profile %q: %s",
			transferProfile.Name,
			err.Error(),
		)
		if errors.Is(err, auth.ErrOIDCNotAuthenticated) {
			return nil, connect.NewError(
				connect.CodeUnauthenticated,
				fmt.Errorf("sign in required for profile %q", transferProfile.Name),
			)
		}
		return nil, fmt.Errorf(strFailedEstablishingAwsSession, err)
	}

	prefix := utils.CleanPrefix("/", req.Msg.Prefix)
	output, err := s3m.ListObjectsAndFolders(prefix, "/")
	if err != nil {
		events.Events.Error(
			"Failed to list objects: %s",
			err.Error(),
		)
		return nil, fmt.Errorf(strFailedToListObjects, prefix)
	}
	for _, object := range output.S3Objects {
		objects = append(objects, &s3_sharedv1.S3Object{
			Key:          object.Key,
			Size:         object.Size,
			LastModified: timestamppb.New(*object.LastModified),
			StorageClass: object.StorageClass,
		})
	}
	folders = append(folders, output.S3Folders...)

	return connect.NewResponse(&s3_sharedv1.S3ListPrefixResponse{
		Prefix:   prefix,
		Prefixes: folders,
		Objects:  objects,
	}), nil
}
