//go:build e2e

package e2e

import (
	"bufio"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	emulatorStartTimeout = 30 * time.Second
	emulatorStopTimeout  = 10 * time.Second
	emulatorLogTail      = 40
	pollInterval         = 100 * time.Millisecond
)

// Environment variables that select how the emulator is provided.
const (
	// envEmulatorBin is the path of the aws-emulator binary (default: aws-emulator on PATH).
	envEmulatorBin = "E2E_EMULATOR_BIN"
	// envEmulatorDir points at the files of an emulator that is already running: a directory
	// holding config, emulator_credentials and ca.pem. envEmulatorEndpoint is its URL.
	envEmulatorDir      = "E2E_EMULATOR_DIR"
	envEmulatorEndpoint = "E2E_EMULATOR_ENDPOINT"
)

// emulator is a running AWS Emulator instance and the files that connect a client to it.
type emulator struct {
	Endpoint        string
	ConfigFile      string
	CredentialsFile string
	CAFile          string

	cmd  *exec.Cmd
	home string

	mu   sync.Mutex
	tail []string
}

type emulatorLogLine struct {
	Fields map[string]any `json:"fields"`
}

// startEmulator starts a private emulator on a free port, or attaches to an external one.
func startEmulator() (*emulator, error) {
	if dir := os.Getenv(envEmulatorDir); dir != "" {
		return externalEmulator(dir, os.Getenv(envEmulatorEndpoint))
	}

	bin := os.Getenv(envEmulatorBin)
	if bin == "" {
		found, err := exec.LookPath("aws-emulator")
		if err != nil {
			return nil, fmt.Errorf("aws-emulator not found on PATH: install it, set %s, or run the suite "+
				"inside the fme-e2e image (task e2e:docker)", envEmulatorBin)
		}
		bin = found
	}

	em := &emulator{}
	if err := em.launch(bin); err != nil {
		em.stop()
		return nil, err
	}
	return em, nil
}

func externalEmulator(dir, endpoint string) (*emulator, error) {
	if endpoint == "" {
		return nil, fmt.Errorf("%s is set but %s is not", envEmulatorDir, envEmulatorEndpoint)
	}
	em := &emulator{
		Endpoint:        endpoint,
		ConfigFile:      filepath.Join(dir, "config"),
		CredentialsFile: filepath.Join(dir, "emulator_credentials"),
		CAFile:          filepath.Join(dir, "ca.pem"),
	}
	return em, em.waitHealthy()
}

func (e *emulator) launch(bin string) error {
	home, err := os.MkdirTemp("", "e2e-emulator-home-")
	if err != nil {
		return err
	}
	e.home = home

	pr, pw := io.Pipe()
	// #nosec G204 -- the binary path comes from the developer's own environment
	e.cmd = exec.Command(bin, "--telemetry", "off", "-p", "0")
	e.cmd.Env = append(os.Environ(), "HOME="+home, "USERPROFILE="+home, "EMULATOR_TELEMETRY=off")
	e.cmd.Stdout, e.cmd.Stderr = pw, pw
	if err := e.cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", bin, err)
	}

	ready := make(chan struct{})
	go e.scanLog(pr, ready)

	select {
	case <-ready:
	case <-time.After(emulatorStartTimeout):
		return fmt.Errorf("emulator did not report its endpoint within %s; log tail:\n%s", emulatorStartTimeout, e.logTail())
	}
	return e.waitHealthy()
}

// scanLog reads the emulator's JSON log, picks the connection details out of the startup lines
// and keeps a short tail for error messages. It runs until the emulator exits.
func (e *emulator) scanLog(r io.Reader, ready chan<- struct{}) {
	var once sync.Once
	sc := bufio.NewScanner(r)
	for sc.Scan() {
		line := sc.Text()
		e.mu.Lock()
		e.tail = append(e.tail, line)
		if len(e.tail) > emulatorLogTail {
			e.tail = e.tail[1:]
		}
		e.absorb(line)
		complete := e.Endpoint != "" && e.CredentialsFile != "" && e.ConfigFile != "" && e.CAFile != ""
		e.mu.Unlock()
		if complete {
			once.Do(func() { close(ready) })
		}
	}
}

func (e *emulator) absorb(line string) {
	var l emulatorLogLine
	if json.Unmarshal([]byte(line), &l) != nil {
		return
	}
	str := func(key string) string {
		v, _ := l.Fields[key].(string)
		return v
	}
	if v := str("endpoint_url"); v != "" {
		e.Endpoint = v
	}
	if v := str("config_file"); v != "" {
		e.ConfigFile = v
	}
	if v := str("ca_file"); v != "" {
		e.CAFile = v
	}
	if v := str("credentials_file"); v != "" {
		e.CredentialsFile = v
	}
}

func (e *emulator) logTail() string {
	e.mu.Lock()
	defer e.mu.Unlock()
	return strings.Join(e.tail, "\n")
}

func (e *emulator) waitHealthy() error {
	client, err := e.httpClient()
	if err != nil {
		return err
	}
	deadline := time.Now().Add(emulatorStartTimeout)
	var last error
	for time.Now().Before(deadline) {
		resp, err := client.Get(e.Endpoint + "/__admin/health")
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
			err = fmt.Errorf("health check returned %s", resp.Status)
		}
		last = err
		time.Sleep(pollInterval)
	}
	return fmt.Errorf("emulator at %s is not healthy: %w", e.Endpoint, last)
}

// httpClient trusts the emulator's CA, which is regenerated on every start.
func (e *emulator) httpClient() (*http.Client, error) {
	pem, err := os.ReadFile(e.CAFile)
	if err != nil {
		return nil, fmt.Errorf("read emulator CA: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(pem) {
		return nil, errors.New("emulator CA file holds no certificate")
	}
	return &http.Client{
		Timeout:   5 * time.Second,
		Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}},
	}, nil
}

// stop terminates a emulator started by this process. An external emulator is left running.
func (e *emulator) stop() {
	if e.cmd != nil && e.cmd.Process != nil {
		if runtime.GOOS == "windows" {
			_ = e.cmd.Process.Kill()
		} else {
			_ = e.cmd.Process.Signal(os.Interrupt)
		}
		done := make(chan struct{})
		go func() { _ = e.cmd.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(emulatorStopTimeout):
			_ = e.cmd.Process.Kill()
		}
	}
	if e.home != "" {
		_ = os.RemoveAll(e.home)
	}
}
