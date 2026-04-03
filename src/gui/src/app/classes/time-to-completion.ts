export function calculateTimeToCompletion(start: Date | string, totalBytes: number, transferredBytes: number): string {
    if (typeof start === 'string') {
        start = new Date(start);
    }

    const dateDiff = (Date.now() - start.getTime()) / 1000;
    if (transferredBytes === 0 || dateDiff === 0) {
        return 'Unknown';
    }
    const bps = transferredBytes / dateDiff;
    const seconds = (totalBytes - transferredBytes) / bps;

    if (seconds <= 0n || Number.isNaN(seconds)) {
        return 'Unknown';
    }

    if (seconds < 5) {
        return 'Just now';
    }

    const intervals = {
        'year': 31536000,
        'month': 2592000,
        'week': 604800,
        'day': 86400,
        'hour': 3600,
        'minute': 60,
        'second': 1,
    };

    for (const [
        range, value,
    ] of Object.entries(intervals)) {
        const counter = Math.floor(seconds / value);
        if (counter > 0) {
            return `${counter} ${range}${counter > 1 ? 's' : ''}`;
        }
    }

    return 'Unknown';
}
