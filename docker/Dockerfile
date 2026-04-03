FROM alpine:latest AS builder

ENV GOBIN="/usr/local/bin"
ENV GOPROXY="direct"

# Install required packages
RUN apk add nodejs npm go make python3 git
RUN go install github.com/bufbuild/buf/cmd/buf@latest
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
RUN go install connectrpc.com/connect/cmd/protoc-gen-connect-go@latest
RUN npm install -g @connectrpc/protoc-gen-connect-es @bufbuild/protoc-gen-es @angular/cli typescript

#################################

# FROM alpine:latest AS output

