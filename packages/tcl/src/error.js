/**
 * TclError - Error class with context for Tcl runtime errors
 *
 * Provides structured error information including:
 * - The error message
 * - The script that caused the error (when available)
 * - Position information (when available)
 * - The command being executed (when available)
 */
export class TclError extends Error {
  constructor(message, context = {}) {
    super(message)
    this.name = 'TclError'
    this.script = context.script ?? null
    this.position = context.position ?? null
    this.command = context.command ?? null
  }

  /**
   * Create a TclError from another error, preserving context
   */
  static from(err, context = {}) {
    if (err instanceof TclError) {
      // Merge contexts, new context takes precedence
      return new TclError(err.message, {
        script: context.script ?? err.script,
        position: context.position ?? err.position,
        command: context.command ?? err.command,
      })
    }
    return new TclError(err.message ?? String(err), context)
  }

  /**
   * Format error with context for display
   */
  toString() {
    let msg = `TclError: ${this.message}`
    if (this.command) {
      msg += `\n  in command: ${this.command}`
    }
    if (this.script && this.script.length < 100) {
      msg += `\n  script: ${this.script}`
    }
    return msg
  }
}
