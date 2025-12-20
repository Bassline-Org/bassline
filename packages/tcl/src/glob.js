// Glob pattern utilities for Tcl

/**
 * Convert a Tcl glob pattern to a JavaScript RegExp
 * Tcl glob patterns use * for any chars, ? for single char
 * All other characters are literal (including regex metacharacters like . + ^ $ etc)
 */
export function globToRegex(pattern) {
  return new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex metacharacters
        .replace(/\*/g, '.*') // * matches any chars
        .replace(/\?/g, '.') + // ? matches single char
      '$'
  )
}
