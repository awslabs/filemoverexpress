import {ShellType} from '../types/installer';

/**
 * Detects the current shell from the $SHELL environment variable
 * @returns The detected ShellType enum value
 * @remarks Falls back to bash if detection fails or shell is not recognized
 */
export function detectCurrentShell(): ShellType {
    const shellPath = process.env.SHELL;

    if (!shellPath) {
        // No $SHELL environment variable, default to bash
        return ShellType.Bash;
    }

    // Extract the shell name from the path (e.g., /bin/bash -> bash)
    const shellName = shellPath.split('/').pop()?.toLowerCase() || '';

    // Match against known shell types
    if (shellName.includes('zsh')) {
        return ShellType.Zsh;
    } else if (shellName.includes('fish')) {
        return ShellType.Fish;
    } else if (shellName.includes('bash')) {
        return ShellType.Bash;
    }

    // Default to bash for unknown shells
    return ShellType.Bash;
}
