// Package e2e is the end-to-end test suite for the File Mover Express daemon.
//
// The tests build the real daemon binary, start it as a separate process, and drive it over
// ConnectRPC. S3 is provided by AWS Emulator, so no AWS account, credentials or bucket are
// needed. All test files carry the "e2e" build tag; run the suite with:
//
//	task cli:e2e                   # emulator installed locally (Linux)
//	task e2e:docker SUITE=daemon   # inside the fme-e2e image (any host with Docker)
//
// See README.md in this directory for how the harness works and how to configure it.
package e2e
