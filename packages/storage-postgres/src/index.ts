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
import { 
  brand
} from '@bassline/core'

// Define errors locally since they're not exported from core
class DatabaseError extends Error {
  constructor(message: string, query: string, params: any[]) {
    super(message)
    this.name = 'DatabaseError'
  }
}

class ValidationError extends Error {
  constructor(message: string, field: string, value: any) {
    super(message)
    this.name = 'ValidationError'
  }
}

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
      console.log('[PostgreSQL] Attempting to get pool connection...')
      client = await this.pool.connect()
      console.log('[PostgreSQL] Got pool connection')
      const result = await operation(client)
      console.log('[PostgreSQL] Operation completed successfully')
      return { ok: true, value: result }
    } catch (error: any) {
      console.error('[PostgreSQL] Error in withClient:', error.message)
      return this.handleError(error)
    } finally {
      if (client) {
        console.log('[PostgreSQL] Releasing pool connection')
        client.release()
      }
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
    // Log the error loudly but return Result for proper error handling
    console.error('[PostgreSQL] DATABASE ERROR:', error.message || error)
    console.error('[PostgreSQL] Error code:', error.code)
    console.error('[PostgreSQL] Stack:', error.stack)
    
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
    console.log(`[PostgreSQL] saveContactContent called for ${networkId}/${groupId}/${contactId}`)
    console.log(`[PostgreSQL] Content to save:`, JSON.stringify(content).slice(0, 100))
    
    return this.withClient(async (client) => {
      console.log(`[PostgreSQL] Got database client for ${contactId}`)
      // Check content size limit
      const contentSize = Buffer.byteLength(JSON.stringify(content))
      
      if (contentSize > this.limits.maxContactContentBytes) {
        throw new ValidationError(
          `Contact content size (${contentSize} bytes) exceeds limit (${this.limits.maxContactContentBytes} bytes)`,
          'content',
          contentSize
        )
      }
      
      // Ensure network exists (auto-create if needed for parallel updates)
      await client.query(`
        INSERT INTO bassline_networks (id, name, description)
        VALUES ($1, $1, 'Auto-created network')
        ON CONFLICT (id) DO NOTHING
      `, [networkId])
      
      // Ensure group exists (auto-create if needed for parallel updates)
      await client.query(`
        INSERT INTO bassline_groups (
          network_id, group_id, name, group_type, 
          boundary_contact_ids, attributes
        )
        VALUES ($1, $2, $2, 'standard', ARRAY[]::text[], '{}'::jsonb)
        ON CONFLICT (network_id, group_id) DO NOTHING
      `, [networkId, groupId])
      
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
          throw new ValidationError(
            `Group contact limit (${this.limits.maxContactsPerGroup}) exceeded`,
            'contactCount',
            parseInt(contactCount.rows[0].count)
          )
        }
      }
      
      console.log(`[PostgreSQL] About to INSERT/UPDATE contact ${contactId}`)
      console.log(`[PostgreSQL] Parameters:`, { contactId, networkId, groupId, contentLength: contentSize })
      console.log(`[PostgreSQL] Content type:`, typeof content, 'Value:', content)
      
      // jsonb columns need proper JSON, so strings need to be wrapped
      const jsonContent = content
      
      const result = await client.query(`
        INSERT INTO bassline_contacts (contact_id, network_id, group_id, content)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (network_id, group_id, contact_id) 
        DO UPDATE SET content = $4::jsonb, updated_at = NOW()
        RETURNING contact_id
      `, [contactId, networkId, groupId, JSON.stringify(jsonContent)]) // Always stringify for jsonb
      
      console.log(`[PostgreSQL] Query result for ${contactId}:`, result.rows.length, 'rows')
      
      if (!result.rows.length) {
        throw new DatabaseError(
          `Failed to save contact ${contactId} to network ${networkId} group ${groupId}`,
          'INSERT INTO bassline_contacts',
          [contactId, networkId, groupId, serializedContent]
        )
      }
      
      console.log(`[PostgreSQL] Successfully saved contact ${contactId} to database`)
      
      // Verify it was actually saved
      const verifyResult = await client.query(`
        SELECT contact_id FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2 AND contact_id = $3
      `, [networkId, groupId, contactId])
      
      console.log(`[PostgreSQL] Verification for ${contactId}: found ${verifyResult.rows.length} rows`)
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
      
      // PostgreSQL jsonb columns automatically return parsed objects
      return result.rows[0].content as T
    })
  }
  
  // Group Operations  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Extract group metadata from state
      const group = state.group
      const contacts = state.contacts
      const boundaryContactIds = group.boundaryContactIds || []
      
      // Save group metadata to normalized table
      await client.query(`
        INSERT INTO bassline_groups (
          network_id, group_id, name, description, group_type, 
          boundary_contact_ids, attributes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (network_id, group_id) 
        DO UPDATE SET 
          name = $3, 
          description = $4, 
          group_type = $5,
          boundary_contact_ids = $6, 
          attributes = $7, 
          updated_at = NOW()
      `, [
        networkId, 
        groupId, 
        group.name || null,
        null, // description - not in current Group type
        'regular', // group_type - default for now
        boundaryContactIds,
        {} // attributes - empty object (jsonb column)
      ])
      
      // Delete contacts that are no longer in the group
      const contactIds = Array.from(contacts.keys())
      if (contactIds.length > 0) {
        await client.query(`
          DELETE FROM bassline_contacts 
          WHERE network_id = $1 AND group_id = $2 
          AND contact_id != ALL($3::text[])
        `, [networkId, groupId, contactIds])
      } else {
        // Delete all contacts if no contacts in the new state
        await client.query(`
          DELETE FROM bassline_contacts 
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId])
      }
      
      // Save individual contacts to the normalized contacts table
      for (const [contactId, contact] of contacts) {
        await client.query(`
          INSERT INTO bassline_contacts (
            network_id, group_id, contact_id, name, blend_mode,
            is_boundary, boundary_direction, content
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (network_id, group_id, contact_id) 
          DO UPDATE SET 
            name = $4,
            blend_mode = $5,
            is_boundary = $6,
            boundary_direction = $7,
            content = $8, 
            updated_at = NOW()
        `, [
          networkId, 
          groupId, 
          contactId, 
          contact.name || null,
          contact.blendMode || 'accept-last',
          contact.isBoundary || false,
          contact.boundaryDirection || null,
          contact.content // Direct value for jsonb column
        ])
      }
    })
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    return this.withClient(async (client) => {
      // Load group metadata from normalized table
      const groupResult = await client.query(`
        SELECT 
          name, description, group_type, boundary_contact_ids, attributes,
          created_at, updated_at
        FROM bassline_groups 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      if (groupResult.rows.length === 0) {
        return null
      }
      
      const groupRow = groupResult.rows[0]
      
      // Load all contacts for this group from normalized table
      const contactsResult = await client.query(`
        SELECT 
          contact_id, name, blend_mode, is_boundary, boundary_direction, 
          content, content_hash, created_at, updated_at
        FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2
        ORDER BY contact_id
      `, [networkId, groupId])
      
      // Reconstruct contacts map
      const contacts = new Map()
      for (const row of contactsResult.rows) {
        contacts.set(row.contact_id, {
          id: row.contact_id,
          name: row.name,
          blendMode: row.blend_mode,
          isBoundary: row.is_boundary,
          boundaryDirection: row.boundary_direction,
          content: row.content, // jsonb columns auto-parse
          groupId: groupId // Add groupId for consistency
        })
      }
      
      // Load wires that involve this group
      const wiresResult = await client.query(`
        SELECT 
          wire_id, from_contact_id, from_group_id, to_contact_id, to_group_id,
          wire_type, priority, attributes
        FROM bassline_wires 
        WHERE network_id = $1 AND (from_group_id = $2 OR to_group_id = $2)
        ORDER BY wire_id
      `, [networkId, groupId])
      
      const wires = new Map()
      for (const row of wiresResult.rows) {
        wires.set(row.wire_id, {
          id: row.wire_id,
          fromId: row.from_contact_id,
          toId: row.to_contact_id,
          type: row.wire_type,
          priority: row.priority,
          groupId: row.from_group_id === groupId ? row.from_group_id : row.to_group_id
        })
      }
      
      // Reconstruct GroupState format
      return {
        group: {
          id: groupId,
          name: groupRow.name,
          contactIds: Array.from(contacts.keys()),
          wireIds: Array.from(wires.keys()),
          subgroupIds: [], // TODO: implement subgroups if needed
          boundaryContactIds: groupRow.boundary_contact_ids || []
        },
        contacts,
        wires
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
      // Save basic network record (no complex state blob needed)
      await client.query(`
        INSERT INTO bassline_networks (id, name, description, attributes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) 
        DO UPDATE SET 
          name = $2,
          description = $3,
          attributes = $4,
          updated_at = NOW()
      `, [
        networkId, 
        null, // name - not in current NetworkState
        null, // description - not in current NetworkState  
        {} // attributes - empty object (jsonb column)
      ])
    })
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    return this.withClient(async (client) => {
      // Check if network exists
      const networkResult = await client.query(`
        SELECT id, name, description, attributes FROM bassline_networks 
        WHERE id = $1
      `, [networkId])
      
      if (networkResult.rows.length === 0) {
        return null
      }
      
      // Load all groups for this network
      const groupsResult = await client.query(`
        SELECT group_id FROM bassline_groups 
        WHERE network_id = $1
        ORDER BY group_id
      `, [networkId])
      
      // Build groups map by loading each group state
      const groups = new Map()
      for (const groupRow of groupsResult.rows) {
        const groupState = await this.loadGroupState(networkId, brand.groupId(groupRow.group_id))
        if (groupState.ok && groupState.value) {
          groups.set(groupRow.group_id, groupState.value)
        }
      }
      
      // Load all wires for this network 
      const wiresResult = await client.query(`
        SELECT 
          wire_id, from_contact_id, from_group_id, to_contact_id, to_group_id,
          wire_type, priority, attributes
        FROM bassline_wires 
        WHERE network_id = $1
        ORDER BY wire_id
      `, [networkId])
      
      const wires = new Map()
      for (const row of wiresResult.rows) {
        wires.set(row.wire_id, {
          id: row.wire_id,
          fromId: row.from_contact_id,
          toId: row.to_contact_id,
          type: row.wire_type,
          priority: row.priority
        })
      }
      
      // Return NetworkState format
      return {
        networkId,
        groups,
        wires,
        currentGroupId: 'root', // Default
        rootGroupId: 'root' // Default
      } as NetworkState
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
  
  // Query Operations with normalized schema
  async queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    return this.withClient(async (client) => {
      let query = `
        SELECT group_id
        FROM bassline_groups 
        WHERE network_id = $1
      `
      const params: any[] = [networkId]
      let paramIndex = 2
      
      // Build dynamic WHERE clauses using normalized columns and JSONB attributes
      if (filter.attributes && Object.keys(filter.attributes).length > 0) {
        const attributeConditions = Object.entries(filter.attributes).map(([key, value]) => {
          params.push(key, JSON.stringify(value))
          return `attributes->$${paramIndex++} = $${paramIndex++}::jsonb`
        })
        query += ` AND (${attributeConditions.join(' AND ')})`
      }
      
      if (filter.author) {
        params.push(filter.author)
        query += ` AND (
          attributes->>'bassline.author' = $${paramIndex} OR
          attributes->>'author' = $${paramIndex}
        )`
        paramIndex++
      }
      
      if (filter.type) {
        params.push(filter.type)
        query += ` AND (
          group_type = $${paramIndex} OR
          attributes->>'bassline.type' = $${paramIndex} OR
          attributes->>'type' = $${paramIndex}
        )`
        paramIndex++
      }
      
      if (filter.tags && filter.tags.length > 0) {
        params.push(filter.tags)
        query += ` AND (
          attributes->'bassline.tags' ?| $${paramIndex}::text[] OR
          attributes->'tags' ?| $${paramIndex}::text[]
        )`
        paramIndex++
      }
      
      query += ` ORDER BY updated_at DESC`
      
      const result = await client.query(query, params)
      
      // Load full group states for matching groups
      const groupStates: GroupState[] = []
      for (const row of result.rows) {
        const groupState = await this.loadGroupState(networkId, brand.groupId(row.group_id))
        if (groupState.ok && groupState.value) {
          groupStates.push(groupState.value)
        }
      }
      
      return groupStates
    })
  }
  
  // Versioning & Snapshots
  async saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    return this.withTransaction(async (client) => {
      // Load current network state (reconstruct from normalized tables)
      const networkState = await this.loadNetworkState(networkId)
      if (!networkState.ok || !networkState.value) {
        throw new ValidationError(
          `Network ${networkId} not found`,
          'networkId',
          networkId
        )
      }
      
      const state = networkState.value // Direct value for jsonb column
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      
      await client.query(`
        INSERT INTO bassline_snapshots (snapshot_id, network_id, label, snapshot_data)
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
        SELECT snapshot_data FROM bassline_snapshots 
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
        value: result.rows[0].snapshot_data // jsonb columns auto-parse
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
               pg_column_size(snapshot_data) as size_bytes
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
        throw new ValidationError(
          `Network ${networkId} not found`,
          'networkId',
          networkId
        )
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
        SELECT group_id,
               ts_rank(to_tsvector('english', 
                                  COALESCE(name, '') || ' ' || 
                                  COALESCE(description, '') || ' ' ||
                                  COALESCE(attributes->>'description', '')), 
                      plainto_tsquery('english', $2)) as rank
        FROM bassline_groups 
        WHERE network_id = $1 
          AND to_tsvector('english', 
                         COALESCE(name, '') || ' ' || 
                         COALESCE(description, '') || ' ' ||
                         COALESCE(attributes->>'description', '')) 
              @@ plainto_tsquery('english', $2)
        ORDER BY rank DESC, updated_at DESC
        LIMIT 100
      `, [networkId, searchQuery])
      
      // Load full group states for search results
      const groupStates: GroupState[] = []
      for (const row of result.rows) {
        const groupState = await this.loadGroupState(networkId, brand.groupId(row.group_id))
        if (groupState.ok && groupState.value) {
          groupStates.push(groupState.value)
        }
      }
      
      return groupStates
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
          COALESCE(SUM(pg_column_size(attributes)), 0) as group_size
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

// Export the storage driver
export { PostgresStorageDriver } from './postgres-storage-driver.js'
export type { PostgresDriverConfig } from './postgres-storage-driver.js'