/**
 * Types for CLI presets
 */

export interface PresetConfig {
  name: string
  description: string
  run: (options: PresetOptions) => Promise<void>
}

export interface PresetOptions {
  port?: number
  host?: string
  verbose?: boolean
  database?: string
  dbHost?: string
  httpPort?: number
  wsPort?: number
  // Allow preset-specific options
  [key: string]: any
}