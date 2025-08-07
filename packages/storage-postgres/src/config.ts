/**
 * Storage configuration for PostgreSQL backend
 */

export interface StorageConfig {
  // Database connection
  database?: string
  connectionString?: string
  poolSize?: number
  
  // Performance vs Durability trade-off
  durability?: 'full' | 'performance'  // 'full' = LOGGED tables, 'performance' = UNLOGGED
  
  // Batch operation settings
  batchSize?: number
  
  // Cleanup settings for append-only storage
  cleanup?: {
    enabled?: boolean
    interval?: number  // milliseconds
    keepVersions?: number
    cleanupAge?: string  // PostgreSQL interval (e.g., '1 hour')
  }
  
  // Session-level optimizations (applied per connection)
  sessionOptimizations?: {
    synchronousCommit?: boolean  // SET synchronous_commit = ON/OFF
    workMem?: string  // e.g., '256MB'
    maintenanceWorkMem?: string  // e.g., '1GB'
  }
}

export const defaultConfig: Required<StorageConfig> = {
  database: 'bassline',
  connectionString: undefined as any,
  poolSize: 50,
  durability: 'full',  // Default to full durability
  batchSize: 10000,
  cleanup: {
    enabled: false,  // User can enable if needed
    interval: 60000,  // 1 minute
    keepVersions: 1,
    cleanupAge: '1 hour'
  },
  sessionOptimizations: {
    synchronousCommit: true,  // Default to safe
    workMem: '64MB',
    maintenanceWorkMem: '256MB'
  }
}

export function mergeConfig(userConfig: StorageConfig): Required<StorageConfig> {
  return {
    ...defaultConfig,
    ...userConfig,
    cleanup: {
      ...defaultConfig.cleanup,
      ...(userConfig.cleanup || {})
    },
    sessionOptimizations: {
      ...defaultConfig.sessionOptimizations,
      ...(userConfig.sessionOptimizations || {})
    }
  }
}

// Environment-based presets
export const presets = {
  production: {
    durability: 'full' as const,
    sessionOptimizations: {
      synchronousCommit: true,
      workMem: '256MB',
      maintenanceWorkMem: '1GB'
    }
  },
  
  development: {
    durability: 'performance' as const,
    sessionOptimizations: {
      synchronousCommit: false,
      workMem: '128MB',
      maintenanceWorkMem: '512MB'
    }
  },
  
  test: {
    durability: 'performance' as const,
    poolSize: 10,
    sessionOptimizations: {
      synchronousCommit: false,
      workMem: '64MB',
      maintenanceWorkMem: '256MB'
    }
  }
}