/**
 * @bassline/installation - User installation system for Bassline
 */

export { BasslineInstallation } from './installation'
export * from './types'

// Re-export useful types from core for convenience
export type { 
  NetworkStorage,
  StorageConfig,
  GroupState,
  NetworkState,
  Contact,
  Group,
  Wire
} from '@bassline/core'

// Bassline type will be available from @bassline/bassline package