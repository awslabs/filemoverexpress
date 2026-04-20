package transfer_api

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"

	"github.com/awslabs/filemoverexpress/globals"
)

const userAgentKey = "User-Agent"

func buildUserAgentMiddleware() middleware.BuildMiddleware {
	return middleware.BuildMiddlewareFunc("CustomerUserAgent", func(
		ctx context.Context, input middleware.BuildInput, next middleware.BuildHandler,
	) (
		out middleware.BuildOutput, metadata middleware.Metadata, err error,
	) {
		request, ok := input.Request.(*smithyhttp.Request)
		if !ok {
			return out, metadata, fmt.Errorf("unknown transport type %T", input.Request)
		}

		version := globals.GetInstance().GetVersion()
		if strings.Contains(version, "-local-dev") {
			version = "0.0.0"
		}

		var userAgent = fmt.Sprintf(
			"S3A/FME-AWS/%s",
			version,
		)

		value := request.Header.Get(userAgentKey)

		if len(value) > 0 {
			value = value + " " + userAgent
		} else {
			value = userAgent
		}

		request.Header.Set(userAgentKey, value)

		return next.HandleBuild(ctx, input)
	})
}

func attachCustomMiddleware() func(stack *middleware.Stack) error {
	return func(stack *middleware.Stack) error {
		return stack.Build.Add(buildUserAgentMiddleware(), middleware.After)
	}
}
