export const authKey = 'x-fme-key';
// eslint-disable-next-line @stylistic/array-element-newline
export const backoffconnectionFactors: number[] = [0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4, 5];
// Number of connection attempts to allow before showing error notifications.
// This gives the daemon time to start up without alarming the user.
export const initialConnectionGracePeriod = 3;
