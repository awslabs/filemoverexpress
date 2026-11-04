package transfer_api

import (
	"github.com/awslabs/filemoverexpress/constants"
	"github.com/awslabs/filemoverexpress/types/configtypes"
)

// adaptiveDefaultSendBufferDarwin is the per-socket SO_SNDBUF cap adaptive mode
// imposes on macOS when the user set none. 1 MiB was the MTU-1500 throughput knee
// (budget ~307 sockets in the ~512 MiB pool); a larger cap needlessly shrinks the
// budget, a smaller one starves each stream.
const adaptiveDefaultSendBufferDarwin = int32(constants.MiB)

// EffectiveSendBufferBytes resolves the per-socket send buffer the client should
// actually apply: the explicit config value when set, else adaptive mode's macOS
// default, else 0 (OS default, elastic pool). Used for BOTH the socket cap and the
// budget math so the two always agree.
func EffectiveSendBufferBytes(cfg configtypes.FmeConfig, goos string) int32 {
	if cfg.General.SendBufferBytes > 0 {
		return cfg.General.SendBufferBytes
	}
	if cfg.General.AdaptiveConcurrency && goos == "darwin" {
		return adaptiveDefaultSendBufferDarwin
	}
	return 0
}

// ConfigureAdaptiveFromConfig installs (or clears) the global connection limiter
// from config, returning the budget it set (0 when adaptive is off). Call once at
// daemon start. The budget uses the same effective send buffer the sockets apply,
// so the socket count can never overrun the kernel pool.
func ConfigureAdaptiveFromConfig(cfg configtypes.FmeConfig, goos string) int {
	if !cfg.General.AdaptiveConcurrency {
		ConfigureConnectionLimiter(0)
		return 0
	}
	buf := EffectiveSendBufferBytes(cfg, goos)
	budget := ConnectionBudget(HostPoolBytes(goos), int64(buf))
	// An explicit maxConnectionsPerHost caps the adaptive budget too, so an operator
	// can hold the shared socket count below the pool-derived value (e.g. to the
	// measured Linux throughput knee) without turning adaptive off.
	if capHost := int(cfg.General.MaxConnectionsPerHost); capHost > 0 && capHost < budget {
		budget = capHost
	}
	ConfigureConnectionLimiter(budget)
	return budget
}
