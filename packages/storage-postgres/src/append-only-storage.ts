/**
 * Append-Only PostgreSQL storage for Propagation Networks
 * 
 * Key innovation: Leverages the monotonic information growth property
 * of propagation networks to use INSERT-only operations, eliminating
 * UPDATE contention entirely.
 */

import { Pool, PoolClient } from 'pg'
import type { 
  NetworkStorage, 
  StorageError,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  Serializable
} from '@bassline/core'
import { serialize, deserialize } from '@bassline/core'
import { StorageConfig, mergeConfig, presets } from './config'

export class AppendOnlyPostgresStorage implements Partial<NetworkStorage> {
  private pool: Pool
  private cleanupTimer?: NodeJS.Timeout
  private config: Required<StorageConfig>
  private useUnlogged: boolean
  
  constructor(config: StorageConfig = {}) {
    this.config = mergeConfig(config)
    this.useUnlogged = this.config.durability === 'performance'
    
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      database: this.config.database || 'bassline_test',
      max: this.config.poolSize,
      // Optimized for high-throughput inserts
      statement_timeout: 5000,
      idle_in_transaction_session_timeout: 10000
    })
    
    // Start cleanup timer if configured
    if (this.config.cleanup.enabled && this.config.cleanup.interval) {
      this.startCleanupTimer()
    }
  }
  
  private startCleanupTimer() {
    const interval = this.config.cleanup.interval
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupSubsumed()
    }, interval)
  }
  
  private async withClient<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<Result<T, StorageError>> {
    let client: PoolClient | null = null
    
    try {
      client = await this.pool.connect()
      const result = await operation(client)
      return { ok: true, value: result }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    } finally {
      client?.release()
    }
  }
  
  /**
   * Save contact content - APPEND ONLY, no updates!
   */
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      const serialized = JSON.stringify(serialize.any(content))
      
      // Apply session optimizations if configured
      if (this.config.sessionOptimizations) {
        const opts = this.config.sessionOptimizations
        if (opts.synchronousCommit !== undefined) {
          await client.query(`SET synchronous_commit = ${opts.synchronousCommit ? 'ON' : 'OFF'}`)
        }
        if (opts.workMem) {
          await client.query(`SET work_mem = '${opts.workMem}'`)
        }
      }
      
      // Use the append_contact_value function with durability flag
      const result = await client.query(
        'SELECT append_contact_value($1, $2, $3, $4, $5, $6) as version',
        [networkId, groupId, contactId, serialized, 'json', this.useUnlogged]
      )
      
      const version = result.rows[0].version
      
      // Optionally mark old versions as subsumed
      if (this.config.cleanup.keepVersions) {
        await client.query(
          'SELECT mark_subsumed_values($1, $2, $3, $4)',
          [networkId, groupId, contactId, this.config.cleanup.keepVersions]
        )
      }
      
      return
    })
  }
  
  /**
   * Load latest contact content
   */
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(
        'SELECT * FROM get_latest_value($1, $2, $3, $4)',
        [networkId, groupId, contactId, this.useUnlogged]
      )
      
      if (result.rows.length === 0) {
        return null
      }
      
      const { content_value, content_type } = result.rows[0]
      
      if (content_type === 'json' && content_value) {
        return deserialize.any(JSON.parse(content_value)) as T
      }
      
      return content_value as T
    })
  }
  
  /**
   * Batch append for maximum throughput
   */
  async batchAppend(
    operations: Array<{
      networkId: NetworkId
      groupId: GroupId
      contactId: ContactId
      content: any
    }>
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      // Apply session optimizations for batch operations
      if (this.config.sessionOptimizations) {
        const opts = this.config.sessionOptimizations
        if (opts.synchronousCommit !== undefined) {
          await client.query(`SET synchronous_commit = ${opts.synchronousCommit ? 'ON' : 'OFF'}`)
        }
        if (opts.workMem) {
          await client.query(`SET work_mem = '${opts.workMem}'`)
        }
      }
      
      // Prepare batch data for the SQL function
      const batchData = operations.map(op => ({
        network_id: op.networkId,
        group_id: op.groupId,
        contact_id: op.contactId,
        content_value: JSON.stringify(serialize.any(op.content)),
        content_type: 'json'
      }))
      
      // Use the batch_append_values function with durability flag
      await client.query(
        'SELECT * FROM batch_append_values($1::jsonb[], $2)',
        [batchData, this.useUnlogged]
      )
    })
  }
  
  /**
   * Save collection data as individual rows
   */
  async saveCollection(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId,
    collectionType: 'set' | 'list' | 'map',
    entries: Map<string, any> | Set<any> | Array<any>
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      const version = await client.query(
        `SELECT nextval('bassline_version_seq') as version`
      )
      const v = version.rows[0].version
      
      const rows: any[] = []
      
      if (entries instanceof Map) {
        for (const [key, value] of entries) {
          rows.push([
            networkId,
            groupId,
            contactId,
            'map',
            key,
            JSON.stringify(value),
            v
          ])
        }
      } else if (entries instanceof Set) {
        for (const value of entries) {
          // Use hash of value as key for sets
          const key = JSON.stringify(value)
          rows.push([
            networkId,
            groupId,
            contactId,
            'set',
            key,
            key,
            v
          ])
        }
      } else if (Array.isArray(entries)) {
        entries.forEach((value, index) => {
          rows.push([
            networkId,
            groupId,
            contactId,
            'list',
            index.toString(),
            JSON.stringify(value),
            v
          ])
        })
      }
      
      if (rows.length > 0) {
        const query = `
          INSERT INTO bassline_contact_collections 
          (network_id, group_id, contact_id, collection_type, entry_key, entry_value, version)
          VALUES ${rows.map((_, i) => 
            `($${i*7+1}, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`
          ).join(',')}
        `
        await client.query(query, rows.flat())
      }
    })
  }
  
  /**
   * Load collection data
   */
  async loadCollection(
    networkId: NetworkId,
    groupId: GroupId,
    contactId: ContactId,
    collectionType: 'set' | 'list' | 'map'
  ): Promise<Result<Map<string, any> | Set<any> | Array<any>, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT DISTINCT ON (entry_key) 
          entry_key, entry_value
        FROM bassline_contact_collections
        WHERE network_id = $1 
          AND group_id = $2 
          AND contact_id = $3
          AND collection_type = $4
          AND NOT subsumed
        ORDER BY entry_key, version DESC
      `, [networkId, groupId, contactId, collectionType])
      
      if (collectionType === 'map') {
        const map = new Map()
        for (const row of result.rows) {
          map.set(row.entry_key, JSON.parse(row.entry_value))
        }
        return map
      } else if (collectionType === 'set') {
        const set = new Set()
        for (const row of result.rows) {
          set.add(JSON.parse(row.entry_value))
        }
        return set
      } else {
        // List - sort by key (index)
        const sorted = result.rows.sort((a, b) => 
          parseInt(a.entry_key) - parseInt(b.entry_key)
        )
        return sorted.map(row => JSON.parse(row.entry_value))
      }
    })
  }
  
  /**
   * Get statistics about append-only performance
   */
  async getStats(): Promise<Result<any, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query('SELECT * FROM bassline_append_stats')
      return result.rows[0]
    })
  }
  
  /**
   * Cleanup old subsumed values
   */
  async cleanupSubsumed(): Promise<Result<{ deletedValues: number, deletedCollections: number }, StorageError>> {
    return this.withClient(async (client) => {
      const age = this.config.cleanup.cleanupAge || '1 hour'
      const result = await client.query(
        'SELECT * FROM cleanup_subsumed_values($1::interval)',
        [age]
      )
      
      if (result.rows.length > 0) {
        return {
          deletedValues: result.rows[0].deleted_values,
          deletedCollections: result.rows[0].deleted_collections
        }
      }
      
      return { deletedValues: 0, deletedCollections: 0 }
    })
  }
  
  async initialize(): Promise<Result<void, StorageError>> {
    // Check if append-only tables exist
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'bassline_contact_values'
        ) as exists
      `)
      
      if (!result.rows[0].exists) {
        throw new Error('Append-only schema not initialized. Run migration 005.')
      }
    })
  }
  
  async close(): Promise<Result<void, StorageError>> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    await this.pool.end()
    return { ok: true, value: undefined }
  }
}

export function createAppendOnlyStorage(config?: StorageConfig | 'production' | 'development' | 'test') {
  // Handle preset strings
  if (typeof config === 'string') {
    return new AppendOnlyPostgresStorage(presets[config])
  }
  return new AppendOnlyPostgresStorage(config)
}