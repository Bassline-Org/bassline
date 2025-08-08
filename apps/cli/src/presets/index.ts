/**
 * CLI Presets - Different flavors of running Bassline
 */

import defaultPreset from './default'
import unixPipesPreset from './unix-pipes'
import notificationsPreset from './notifications'
import type { PresetConfig } from './types'

// Export all presets
export const presets: Record<string, PresetConfig> = {
  default: defaultPreset,
  'unix-pipes': unixPipesPreset,
  unix: unixPipesPreset, // Alias
  notifications: notificationsPreset,
  notify: notificationsPreset, // Alias
}

// Export for direct import
export { defaultPreset, unixPipesPreset, notificationsPreset }

// Helper to get preset by name
export function getPreset(name: string): PresetConfig | undefined {
  return presets[name]
}

// List all available presets
export function listPresets(): Array<{ name: string; description: string }> {
  return Object.entries(presets).map(([name, preset]) => ({
    name,
    description: preset.description
  }))
}

export default presets