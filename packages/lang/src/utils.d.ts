// Type definitions for @bassline/lang/utils

/**
 * Normalize a string to a symbol for use as a key in contexts
 * @param str The string to normalize
 * @returns A symbol representing the normalized string
 */
export declare function normalize(str: string): symbol;

/**
 * Normalize a string by converting to lowercase and replacing hyphens with underscores
 * @param str The string to normalize
 * @returns The normalized string
 */
export declare function normalizeString(str: string): string;