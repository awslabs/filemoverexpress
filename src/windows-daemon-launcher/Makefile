build-win:
	go mod vendor
	GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H=windowsgui" -o dist/daemon-launcher.exe main.go
