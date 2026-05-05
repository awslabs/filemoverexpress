import semver from 'semver';
import { readFileSync } from 'fs';
import { PathResolver } from './path-resolver';
import path from 'path';

/**
 * Resolves and validates a build version string.
 *
 * - Strips leading 'v' or 'V' prefix
 * - Validates using semver.valid() with semver.coerce() fallback
 * - Falls back to root package.json version when input is undefined
 * - Throws on empty string or invalid semver
 *
 * @param rawVersion - The raw version string from --build-version, or undefined
 * @returns A clean semver string (no 'v' prefix)
 */
export function resolveVersion(rawVersion?: string): string {
    if (rawVersion === undefined) {
        const projectRoot = PathResolver.getProjectRoot();
        const packageJsonPath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        const version = packageJson.version;
        return validateVersion(version);
    }

    if (rawVersion === '') {
        throw new Error('--build-version cannot be an empty string');
    }

    // Strip leading v/V prefix
    const stripped = rawVersion.replace(/^[vV]/, '');

    return validateVersion(stripped);
}

/**
 * Validates a version string using semver.valid() with semver.coerce() fallback.
 * Returns the validated semver string or throws an error.
 */
function validateVersion(version: string): string {
    const valid = semver.valid(version);
    if (valid) {
        return valid;
    }

    const coerced = semver.coerce(version);
    if (coerced) {
        return coerced.version;
    }

    throw new Error(
        `Invalid semantic version: "${version}". Expected format: MAJOR.MINOR.PATCH (e.g. 1.2.3)`,
    );
}
