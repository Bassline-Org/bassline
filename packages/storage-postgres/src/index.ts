/**
 * PostgreSQL storage implementation for Bassline
 * 
 * Provides scalable, ACID-compliant storage with strong domain types,
 * advanced querying capabilities, and optimized performance
 */

import { Pool, PoolClient } from 'pg'
import { readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { 
  NetworkStorage, 
  StorageConfig, 
  StorageError,
  SnapshotInfo, 
  QueryFilter,
  GroupState,
  NetworkState,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  SnapshotId,
  Serializable
} from '@bassline/core'
import { brand, serialize, deserialize } from '@bassline/core'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface PostgresStorageConfig extends StorageConfig {
  options?: {
    connectionString?: string
    host?: string
    port?: number
    database?: string
    user?: string
    password?: string
    ssl?: boolean | object
    poolSize?: number
    connectionTimeout?: number
    idleTimeout?: number
    statementTimeout?: number
  }
  limits?: {
    maxContactsPerGroup?: number      // Default: 10000
    maxGroupsPerNetwork?: number      // Default: 1000
    maxNetworkSizeBytes?: number      // Default: 100MB
    maxContactContentBytes?: number   // Default: 1MB
  }
}

export class PostgresStorage implements NetworkStorage {
  private pool: Pool
  private initialized = false
  private limits: Required<NonNullable<PostgresStorageConfig['limits']>>
  
  constructor(config?: PostgresStorageConfig) {
    const options = config?.options || {}
    
    // Set default limits
    this.limits = {
      maxContactsPerGroup: config?.limits?.maxContactsPerGroup ?? 10000,
      maxGroupsPerNetwork: config?.limits?.maxGroupsPerNetwork ?? 1000,
      maxNetworkSizeBytes: config?.limits?.maxNetworkSizeBytes ?? 100 * 1024 * 1024, // 100MB
      maxContactContentBytes: config?.limits?.maxContactContentBytes ?? 1024 * 1024  // 1MB
    }
    
    this.pool = new Pool({
      connectionString: options.connectionString,
      host: options.host || 'localhost',
      port: options.port || 5432,
      database: options.database || 'bassline',
      user: options.user || process.env.USER,
      password: options.password,
      ssl: options.ssl,
      max: options.poolSize || 20,
      connectionTimeoutMillis: options.connectionTimeout || 5000,
      idleTimeoutMillis: options.idleTimeout || 30000,
      statement_timeout: options.statementTimeout || 60000
    })
  }
  
  // ============================================================================
  // Helper Methods  
  // ============================================================================
  
  private async withClient<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<Result<T, StorageError>> {
    let client: PoolClient | null = null
    
    try {
      client = await this.pool.connect()
      const result = await operation(client)
      return { ok: true, value: result }
    } catch (error: any) {
      return this.handleError(error)
    } finally {
      client?.release()
    }
  }
  
  private async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>
  ): Promise<Result<T, StorageError>> {
    return this.withClient(async (client) => {
      await client.query('BEGIN')
      try {
        const result = await operation(client)
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    })
  }
  
  private handleError(error: any): Result<never, StorageError> {
    // PostgreSQL specific error handling
    if (error.code === '23503') { // Foreign key violation
      return {
        ok: false,
        error: {
          code: 'NETWORK_NOT_FOUND',
          message: 'Referenced network or group not found',
          details: error
        }
      }
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: 'Failed to connect to PostgreSQL',
          details: error
        }
      }
    }
    
    if (error.code === '42P01') { // Undefined table
      return {
        ok: false,
        error: {
          code: 'STORAGE_CORRUPTION_ERROR',
          message: 'Database schema not initialized',
          details: error
        }
      }
    }
    
    if (error.code === '22P02') { // Invalid JSON
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: 'Invalid JSON data',
          details: error
        }
      }
    }
    
    return {
      ok: false,
      error: {
        code: 'STORAGE_CONNECTION_ERROR',
        message: error.message || 'Unknown PostgreSQL error',
        details: error
      }
    }
  }
  
  // ============================================================================
  // NetworkStorage Implementation
  // ============================================================================
  
  // Contact Operations
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      // Check content size limit
      const serializedContent = serialize.any(content)
      const contentSize = Buffer.byteLength(JSON.stringify(serializedContent))
      
      if (contentSize > this.limits.maxContactContentBytes) {
        throw new Error(
          `Contact content size (${contentSize} bytes) exceeds limit (${this.limits.maxContactContentBytes} bytes)`
        )
      }
      
      // Check group contact limit for new contacts
      const existingContact = await client.query(`
        SELECT 1 FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2 AND contact_id = $3
      `, [networkId, groupId, contactId])
      
      if (existingContact.rows.length === 0) {
        const contactCount = await client.query(`
          SELECT COUNT(*) as count FROM bassline_contacts 
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId])
        
        if (parseInt(contactCount.rows[0].count) >= this.limits.maxContactsPerGroup) {
          throw new Error(
            `Group contact limit (${this.limits.maxContactsPerGroup}) exceeded`
          )
        }
      }
      
      await client.query(`
        INSERT INTO bassline_contacts (contact_id, network_id, group_id, content)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (network_id, group_id, contact_id) 
        DO UPDATE SET content = $4, updated_at = NOW()
      `, [contactId, networkId, groupId, serializedContent])
    })
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT content FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2 AND contact_id = $3
      `, [networkId, groupId, contactId])
      
      if (result.rows.length === 0) {
        return null
      }
      
      return deserialize.any(result.rows[0].content) as T
    })
  }
  
  // Group Operations  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Create a copy of state without contacts for storage
      const { contacts, ...stateWithoutContacts } = state
      const groupMetadata = {
        ...stateWithoutContacts,
        contactIds: Array.from(contacts.keys()) // Store just the IDs for reference
      }
      
      // Save group metadata (without full contact data)
      await client.query(`
        INSERT INTO bassline_groups (network_id, group_id, state)
        VALUES ($1, $2, $3)
        ON CONFLICT (network_id, group_id) 
        DO UPDATE SET state = $3, updated_at = NOW()
      `, [networkId, groupId, serialize.any(groupMetadata)])
      
      // Delete contacts that are no longer in the group
      await client.query(`
        DELETE FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2 
        AND contact_id != ALL($3::text[])
      `, [networkId, groupId, Array.from(contacts.keys())])
      
      // Save individual contacts to the contacts table
      for (const [contactId, contact] of contacts) {
        await client.query(`
          INSERT INTO bassline_contacts (contact_id, network_id, group_id, content)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (network_id, group_id, contact_id) 
          DO UPDATE SET content = $4, updated_at = NOW()
        `, [contactId, networkId, groupId, serialize.any(contact.content)])
      }
    })
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    return this.withClient(async (client) => {
      // Load group metadata
      const groupResult = await client.query(`
        SELECT state FROM bassline_groups 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      if (groupResult.rows.length === 0) {
        return null
      }
      
      const groupMetadata = groupResult.rows[0].state
      
      // Load all contacts for this group
      const contactsResult = await client.query(`
        SELECT contact_id, content 
        FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      // Reconstruct the full group state
      const contacts = new Map()
      for (const row of contactsResult.rows) {
        contacts.set(row.contact_id, {
          content: deserialize.any(row.content)
        })
      }
      
      // Remove contactIds from metadata and add actual contacts
      const { contactIds, ...stateWithoutIds } = groupMetadata
      
      return {
        ...stateWithoutIds,
        contacts
      } as GroupState
    })
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Delete contacts first (CASCADE should handle this, but being explicit)
      await client.query(`
        DELETE FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      // Delete group
      await client.query(`
        DELETE FROM bassline_groups 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
    })
  }
  
  // Network Operations
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`
        INSERT INTO bassline_networks (id, state)
        VALUES ($1, $2)
        ON CONFLICT (id) 
        DO UPDATE SET state = $2, updated_at = NOW()
      `, [networkId, serialize.networkState(state)])
    })
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT state FROM bassline_networks 
        WHERE id = $1
      `, [networkId])
      
      if (result.rows.length === 0) {
        return null
      }
      
      return deserialize.networkState(result.rows[0].state)
    })
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT id FROM bassline_networks 
        ORDER BY updated_at DESC
      `)
      
      return result.rows.map(row => brand.networkId(row.id))
    })
  }
  
  async deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      // CASCADE should handle related records
      await client.query(`
        DELETE FROM bassline_networks WHERE id = $1
      `, [networkId])
    })
  }
  
  async exists(
    networkId: NetworkId
  ): Promise<Result<boolean, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT 1 FROM bassline_networks WHERE id = $1 LIMIT 1
      `, [networkId])
      
      return result.rows.length > 0
    })
  }
  
  // Query Operations with advanced PostgreSQL features
  async queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    return this.withClient(async (client) => {
      let query = `
        SELECT state 
        FROM bassline_groups 
        WHERE network_id = $1
      `
      const params: any[] = [networkId]
      let paramIndex = 2
      
      // Build dynamic WHERE clauses using PostgreSQL JSONB operators
      if (filter.attributes && Object.keys(filter.attributes).length > 0) {
        const attributeConditions = Object.entries(filter.attributes).map(([key, value]) => {
          params.push(key, JSON.stringify(value))
          return `state->'group'->'attributes'->$${paramIndex++} = $${paramIndex++}::jsonb`
        })
        query += ` AND (${attributeConditions.join(' AND ')})`
      }
      
      if (filter.author) {
        params.push(filter.author)
        query += ` AND (
          state->'group'->'attributes'->>'bassline.author' = $${paramIndex} OR
          state->'group'->'attributes'->>'author' = $${paramIndex}
        )`
        paramIndex++
      }
      
      if (filter.type) {
        params.push(filter.type)
        query += ` AND (
          state->'group'->'attributes'->>'bassline.type' = $${paramIndex} OR
          state->'group'->'attributes'->>'type' = $${paramIndex}
        )`
        paramIndex++
      }
      
      if (filter.tags && filter.tags.length > 0) {
        params.push(filter.tags)
        query += ` AND (
          state->'group'->'attributes'->'bassline.tags' ?| $${paramIndex}::text[] OR
          state->'group'->'attributes'->'tags' ?| $${paramIndex}::text[]
        )`
        paramIndex++
      }
      
      query += ` ORDER BY updated_at DESC`
      
      const result = await client.query(query, params)
      return result.rows.map(row => deserialize.groupState(row.state))
    })
  }
  
  // Versioning & Snapshots
  async saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    return this.withTransaction(async (client) => {
      // Load current network state
      const stateResult = await client.query(`
        SELECT state FROM bassline_networks WHERE id = $1
      `, [networkId])
      
      if (stateResult.rows.length === 0) {
        throw new Error(`Network ${networkId} not found`)
      }
      
      const state = stateResult.rows[0].state // Already an object from JSONB
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      
      await client.query(`
        INSERT INTO bassline_snapshots (snapshot_id, network_id, label, state)
        VALUES ($1, $2, $3, $4)
      `, [snapshotId, networkId, label, state])
      
      return snapshotId
    })
  }
  
  async loadSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>> {
    try {
      const result = await this.pool.query(`
        SELECT state FROM bassline_snapshots 
        WHERE network_id = $1 AND snapshot_id = $2
      `, [networkId, snapshotId])
      
      if (result.rows.length === 0) {
        return {
          ok: false,
          error: {
            code: 'SNAPSHOT_NOT_FOUND',
            message: `Snapshot ${snapshotId} not found for network ${networkId}`
          }
        }
      }
      
      return { 
        ok: true, 
        value: deserialize.networkState(result.rows[0].state)
      }
    } catch (error: any) {
      return this.handleError(error)
    }
  }
  
  async listSnapshots(
    networkId: NetworkId
  ): Promise<Result<SnapshotInfo[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT snapshot_id, network_id, label, created_at, 
               pg_column_size(state) as size_bytes
        FROM bassline_snapshots 
        WHERE network_id = $1
        ORDER BY created_at DESC
      `, [networkId])
      
      return result.rows.map(row => ({
        id: brand.snapshotId(row.snapshot_id),
        networkId: brand.networkId(row.network_id),
        label: row.label,
        createdAt: new Date(row.created_at),
        size: row.size_bytes
      }))
    })
  }
  
  async deleteSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`
        DELETE FROM bassline_snapshots 
        WHERE network_id = $1 AND snapshot_id = $2
      `, [networkId, snapshotId])
    })
  }
  
  // Advanced PostgreSQL-specific methods
  
  /**
   * Get network statistics using PostgreSQL aggregation functions
   */
  async getNetworkStats(networkId: NetworkId): Promise<Result<{
    groupCount: number
    contactCount: number  
    snapshotCount: number
    totalSize: number
    lastUpdated: Date
  }, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT 
          group_count,
          contact_count,
          snapshot_count,
          total_size_bytes,
          updated_at as last_updated
        FROM bassline_network_stats 
        WHERE network_id = $1
      `, [networkId])
      
      if (result.rows.length === 0) {
        throw new Error(`Network ${networkId} not found`)
      }
      
      const row = result.rows[0]
      
      return {
        groupCount: parseInt(row.group_count) || 0,
        contactCount: parseInt(row.contact_count) || 0,
        snapshotCount: parseInt(row.snapshot_count) || 0,
        totalSize: parseInt(row.total_size_bytes) || 0,
        lastUpdated: new Date(row.last_updated)
      }
    })
  }
  
  /**
   * Full-text search across group attributes using PostgreSQL's text search
   */
  async searchGroups(
    networkId: NetworkId,
    searchQuery: string
  ): Promise<Result<GroupState[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT state,
               ts_rank(to_tsvector('english', state->'group'->>'name' || ' ' || 
                                  COALESCE(state->'group'->'attributes'->>'description', '')), 
                      plainto_tsquery('english', $2)) as rank
        FROM bassline_groups 
        WHERE network_id = $1 
          AND to_tsvector('english', state->'group'->>'name' || ' ' || 
                                    COALESCE(state->'group'->'attributes'->>'description', '')) 
              @@ plainto_tsquery('english', $2)
        ORDER BY rank DESC, updated_at DESC
        LIMIT 100
      `, [networkId, searchQuery])
      
      return result.rows.map(row => deserialize.groupState(row.state))
    })
  }
  
  /**
   * Check if network size is within limits
   */
  async checkNetworkLimits(networkId: NetworkId): Promise<Result<{
    groupCount: number
    totalSizeBytes: number
    withinLimits: boolean
    details: {
      groupLimitExceeded: boolean
      sizeLimitExceeded: boolean
    }
  }, StorageError>> {
    return this.withClient(async (client) => {
      // Get group count
      const groupCountResult = await client.query(`
        SELECT COUNT(*) as count FROM bassline_groups WHERE network_id = $1
      `, [networkId])
      const groupCount = parseInt(groupCountResult.rows[0].count)
      
      // Get total size (approximate)
      const sizeResult = await client.query(`
        SELECT 
          COALESCE(SUM(pg_column_size(content)), 0) as contact_size,
          COALESCE(SUM(pg_column_size(state)), 0) as group_size
        FROM bassline_contacts c
        FULL OUTER JOIN bassline_groups g ON c.network_id = g.network_id
        WHERE COALESCE(c.network_id, g.network_id) = $1
      `, [networkId])
      
      const totalSizeBytes = parseInt(sizeResult.rows[0].contact_size) + 
                            parseInt(sizeResult.rows[0].group_size)
      
      const groupLimitExceeded = groupCount > this.limits.maxGroupsPerNetwork
      const sizeLimitExceeded = totalSizeBytes > this.limits.maxNetworkSizeBytes
      
      return {
        groupCount,
        totalSizeBytes,
        withinLimits: !groupLimitExceeded && !sizeLimitExceeded,
        details: {
          groupLimitExceeded,
          sizeLimitExceeded
        }
      }
    })
  }
  
  // Lifecycle  
  async initialize(): Promise<Result<void, StorageError>> {
    if (this.initialized) {
      return { ok: true, value: undefined }
    }
    
    try {
      // Check if migrations have been run
      const tableCheckResult = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'bassline_networks'
        ) as exists
      `)
      
      if (!tableCheckResult.rows[0].exists) {
        return {
          ok: false,
          error: {
            code: 'STORAGE_CORRUPTION_ERROR',
            message: 'Database schema not initialized. Please run migrations.',
            details: 'Run "pnpm migrate" to initialize the database schema'
          }
        }
      }
      
      this.initialized = true
      return { ok: true, value: undefined }
    } catch (error: any) {
      return this.handleError(error)
    }
  }
  
  async close(): Promise<Result<void, StorageError>> {
    try {
      await this.pool.end()
      return { ok: true, value: undefined }
    } catch (error: any) {
      return this.handleError(error)
    }
  }
}

// Factory function
export function createPostgresStorage(config?: PostgresStorageConfig): NetworkStorage {
  return new PostgresStorage(config)
}