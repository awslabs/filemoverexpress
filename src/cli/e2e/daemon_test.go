//go:build e2e

package e2e

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"connectrpc.com/connect"

	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1"
	"github.com/awslabs/filemoverexpress/types/pbtypes/fme/v1/fmev1connect"
)

const (
	// daemonPort is the fixed port of the daemon's local API (service.GrpcDefaultWebPort). The
	// daemon cannot listen elsewhere without --remote, so the suite runs one daemon at a time.
	daemonPort         = 50006
	daemonURL          = "http://127.0.0.1:50006"
	daemonStartTimeout = 60 * time.Second
	daemonStopTimeout  = 15 * time.Second

	// guiOrigin is accepted by the daemon's origin check without any configuration.
	guiOrigin = "wails://wails.localhost"

	// envDaemonBinary overrides the daemon binary; by default the suite builds it from source.
	envDaemonBinary = "E2E_DAEMON_BINARY"
)

// daemon is a running filemoverexpress daemon process and an RPC client for it.
type daemon struct {
	Client fmev1connect.FmeServiceClient

	cmd     *exec.Cmd
	exited  chan error
	logFile string
}

// newClient returns an RPC client that sends an allowed Origin, as the GUI does.
func newClient(baseURL string) fmev1connect.FmeServiceClient {
	origin := connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			req.Header().Set("Origin", guiOrigin)
			return next(ctx, req)
		}
	})
	return fmev1connect.NewFmeServiceClient(http.DefaultClient, baseURL, connect.WithInterceptors(origin))
}

// buildDaemon compiles the daemon from the working tree into dir, unless a prebuilt binary is given.
func buildDaemon(dir string) (string, error) {
	if bin := os.Getenv(envDaemonBinary); bin != "" {
		return bin, nil
	}
	root, err := exec.Command("go", "list", "-m", "-f", "{{.Dir}}").Output()
	if err != nil {
		return "", fmt.Errorf("locate module root: %w", err)
	}
	out := filepath.Join(dir, "filemoverexpress")
	if runtime.GOOS == "windows" {
		out += ".exe"
	}
	cmd := exec.Command("go", "build", "-trimpath", "-o", out, ".")
	cmd.Dir = strings.TrimSpace(string(root))
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0")
	if msg, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("build daemon: %w\n%s", err, msg)
	}
	return out, nil
}

// requirePortFree fails early, with a hint, when something already holds the daemon's port.
func requirePortFree() error {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", daemonPort))
	if err != nil {
		return fmt.Errorf("port %d is in use (is File Mover Express or another suite run open?): %w", daemonPort, err)
	}
	return ln.Close()
}

// startDaemon launches the daemon with an isolated config directory and waits until it answers.
func startDaemon(bin, workDir string, em *emulator, cfg daemonConfig) (*daemon, error) {
	if err := requirePortFree(); err != nil {
		return nil, err
	}
	configDir := filepath.Join(workDir, "fme-config")
	home := filepath.Join(workDir, "fme-home")
	for _, d := range []string{configDir, home} {
		if err := os.MkdirAll(d, 0o750); err != nil {
			return nil, err
		}
	}
	if err := os.WriteFile(filepath.Join(configDir, "configuration.yaml"), []byte(cfg.yaml()), 0o600); err != nil {
		return nil, err
	}

	logPath := filepath.Join(workDir, "daemon.log")
	logFile, err := os.Create(logPath) // #nosec G304 -- path under the suite's own temp dir
	if err != nil {
		return nil, err
	}

	// #nosec G204 -- the binary is the suite's own build or an explicit developer override
	cmd := exec.Command(bin, "daemon")
	cmd.Dir = workDir
	cmd.Env = append(cleanEnv(), daemonEnv(configDir, home, em)...)
	cmd.Stdout, cmd.Stderr = logFile, logFile
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start daemon: %w", err)
	}

	d := &daemon{Client: newClient(daemonURL), cmd: cmd, exited: make(chan error, 1), logFile: logPath}
	go func() { d.exited <- cmd.Wait(); _ = logFile.Close() }()

	if err := d.waitReady(); err != nil {
		d.kill()
		return nil, fmt.Errorf("%w\n--- daemon log ---\n%s", err, d.log())
	}
	return d, nil
}

// cleanEnv drops inherited AWS and FME variables so a developer's own setup cannot leak in.
func cleanEnv() []string {
	var env []string
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "AWS_") || strings.HasPrefix(kv, "FME_") || strings.HasPrefix(kv, "SSL_CERT") {
			continue
		}
		env = append(env, kv)
	}
	return env
}

func daemonEnv(configDir, home string, em *emulator) []string {
	return []string{
		"FME_CONFIG_DIR=" + configDir,
		// Without this the Shutdown RPC is refused, and the daemon is stopped by killing it.
		"FME_GUI_DAEMON=true",
		"HOME=" + home,
		"USERPROFILE=" + home,
		"AWS_CONFIG_FILE=" + em.ConfigFile,
		"AWS_SHARED_CREDENTIALS_FILE=" + em.CredentialsFile,
		"AWS_EC2_METADATA_DISABLED=true",
	}
}

func (d *daemon) waitReady() error {
	deadline := time.Now().Add(daemonStartTimeout)
	var last error
	for time.Now().Before(deadline) {
		select {
		case err := <-d.exited:
			return fmt.Errorf("daemon exited during start: %v", err)
		default:
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_, err := d.Client.GetConfiguration(ctx, connect.NewRequest(&fmev1.GetConfigurationRequest{}))
		cancel()
		if err == nil {
			return nil
		}
		last = err
		time.Sleep(pollInterval)
	}
	return fmt.Errorf("daemon did not become ready within %s: %w", daemonStartTimeout, last)
}

// stop asks the daemon to shut down through the API and falls back to killing it.
func (d *daemon) stop() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	resp, err := d.Client.Shutdown(ctx, connect.NewRequest(&fmev1.ShutdownRequest{}))
	if err == nil && resp.Msg.Result != fmev1.ShutdownResult_SHUTDOWN_RESULT_SUCCEEDED {
		err = fmt.Errorf("shutdown refused: %s", resp.Msg.Result)
	}
	select {
	case <-d.exited:
	case <-time.After(daemonStopTimeout):
		d.kill()
		return errors.Join(err, errors.New("daemon did not exit after shutdown and was killed"))
	}
	return err
}

func (d *daemon) kill() {
	if d.cmd.Process != nil {
		_ = d.cmd.Process.Kill()
	}
	select {
	case <-d.exited:
	case <-time.After(daemonStopTimeout):
	}
}

func (d *daemon) log() string {
	b, err := os.ReadFile(d.logFile)
	if err != nil {
		return err.Error()
	}
	return string(b)
}
