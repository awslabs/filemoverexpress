export const authKey = 'x-fme-key';
// eslint-disable-next-line @stylistic/array-element-newline
export const backoffconnectionFactors: number[] = [0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4, 5];
// Number of connection attempts to allow before surfacing the disconnected/"Connection
// Failed" state and error notifications. This keeps the UI in "Connecting…" while the
// daemon spins up on startup (and during brief blips) instead of flashing an error, and
// only alarms the user once we've genuinely failed to reach it. With the backoff factors
// below, 5 attempts is roughly 1.8-3.3s of grace — comfortably past normal daemon startup.
export const initialConnectionGracePeriod = 5;
