/**
 * PostgreSQL normalized storage implementation for Bassline
 * 
 * Uses properly normalized tables instead of JSONB for better performance
 * and scalability with large datasets
 */

import { Pool, PoolClient } from 'pg'
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
  Serializable,
  WireId
} from '@bassline/core'
import { brand, serialize, deserialize } from '@bassline/core'

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
    maxContactsPerGroup?: number
    maxGroupsPerNetwork?: number
    maxContentSizeBytes?: number
  }
}

export class NormalizedPostgresStorage implements NetworkStorage {
  private pool: Pool
  private initialized = false
  private limits: Required<NonNullable<PostgresStorageConfig['limits']>>
  
  constructor(config?: PostgresStorageConfig) {
    const options = config?.options || {}
    
    this.limits = {
      maxContactsPerGroup: config?.limits?.maxContactsPerGroup ?? 10000,
      maxGroupsPerNetwork: config?.limits?.maxGroupsPerNetwork ?? 1000,
      maxContentSizeBytes: config?.limits?.maxContentSizeBytes ?? 100 * 1024 // 100KB
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
    if (error.code === '23503') {
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
    
    return {
      ok: false,
      error: {
        code: 'STORAGE_CONNECTION_ERROR',
        message: error.message || 'Unknown PostgreSQL error',
        details: error
      }
    }
  }
  
  // Contact Operations
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      const serialized = serialize.any(content)
      const contentStr = JSON.stringify(serialized)
      const contentSize = Buffer.byteLength(contentStr)
      
      if (contentSize > this.limits.maxContentSizeBytes) {
        throw new Error(`Content size (${contentSize}) exceeds limit (${this.limits.maxContentSizeBytes})`)
      }
      
      // Ensure contact exists
      await client.query(`
        INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (network_id, group_id, contact_id) DO NOTHING
      `, [networkId, groupId, contactId])
      
      // Save content
      await client.query(`
        INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
        VALUES ($1, $2, $3, 'json', $4)
        ON CONFLICT (network_id, group_id, contact_id) 
        DO UPDATE SET content_value = $4, updated_at = NOW()
      `, [networkId, groupId, contactId, contentStr])
    })
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT content_value, content_type FROM bassline_contact_content 
        WHERE network_id = $1 AND group_id = $2 AND contact_id = $3
      `, [networkId, groupId, contactId])
      
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
  
  // Group Operations  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Check limits
      if (state.contacts.size > this.limits.maxContactsPerGroup) {
        throw new Error(`Group has too many contacts (${state.contacts.size} > ${this.limits.maxContactsPerGroup})`)
      }
      
      // Insert or update group
      const groupType = (state as any).primitiveType ? 'primitive' : 'standard'
      const primitiveType = (state as any).primitiveType || null
      
      await client.query(`
        INSERT INTO bassline_groups_v2 (network_id, group_id, group_type, primitive_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (network_id, group_id) 
        DO UPDATE SET group_type = $3, primitive_type = $4, updated_at = NOW()
      `, [networkId, groupId, groupType, primitiveType])
      
      // Save attributes if present
      if ((state as any).attributes) {
        for (const [key, value] of Object.entries((state as any).attributes)) {
          await client.query(`
            INSERT INTO bassline_group_attributes (network_id, group_id, attribute_key, attribute_value)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (network_id, group_id, attribute_key)
            DO UPDATE SET attribute_value = $4
          `, [networkId, groupId, key, String(value)])
        }
      }
      
      // Delete removed contacts
      const contactIds = Array.from(state.contacts.keys())
      if (contactIds.length > 0) {
        await client.query(`
          DELETE FROM bassline_contacts_v2 
          WHERE network_id = $1 AND group_id = $2 
          AND contact_id != ALL($3::text[])
        `, [networkId, groupId, contactIds])
      } else {
        // Delete all contacts if none exist
        await client.query(`
          DELETE FROM bassline_contacts_v2 
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId])
      }
      
      // Save contacts using batch insert
      if (state.contacts.size > 0) {
        // Prepare batch data
        const contactRows: any[] = []
        const contentRows: any[] = []
        
        for (const [contactId, contact] of state.contacts) {
          const contactType = 'standard'
          const blendMode = (contact as any).blendMode || 'accept-last'
          
          contactRows.push([networkId, groupId, contactId, contactType, blendMode])
          
          if (contact.content !== undefined && contact.content !== null) {
            const serialized = serialize.any(contact.content)
            const contentStr = JSON.stringify(serialized)
            contentRows.push([networkId, groupId, contactId, 'json', contentStr])
          }
        }
        
        // Batch insert contacts
        if (contactRows.length > 0) {
          const contactValues = contactRows.map((_, i) => 
            `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
          ).join(',')
          
          await client.query(`
            INSERT INTO bassline_contacts_v2 (network_id, group_id, contact_id, contact_type, blend_mode)
            VALUES ${contactValues}
            ON CONFLICT (network_id, group_id, contact_id) 
            DO UPDATE SET 
              contact_type = EXCLUDED.contact_type, 
              blend_mode = EXCLUDED.blend_mode, 
              updated_at = NOW()
          `, contactRows.flat())
        }
        
        // Batch insert content
        if (contentRows.length > 0) {
          const contentValues = contentRows.map((_, i) => 
            `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
          ).join(',')
          
          await client.query(`
            INSERT INTO bassline_contact_content (network_id, group_id, contact_id, content_type, content_value)
            VALUES ${contentValues}
            ON CONFLICT (network_id, group_id, contact_id) 
            DO UPDATE SET 
              content_value = EXCLUDED.content_value, 
              updated_at = NOW()
          `, contentRows.flat())
        }
      }
      
      // Save wires using batch insert
      await client.query(`
        DELETE FROM bassline_wires 
        WHERE network_id = $1 
        AND (from_group_id = $2 OR to_group_id = $2)
      `, [networkId, groupId])
      
      if (state.wires.size > 0) {
        const wireRows: any[] = []
        for (const [wireId, wire] of state.wires) {
          wireRows.push([
            networkId, wireId,
            (wire as any).from.groupId || groupId, (wire as any).from.contactId,
            (wire as any).to.groupId || groupId, (wire as any).to.contactId,
            (wire as any).type || 'bidirectional'
          ])
        }
        
        const wireValues = wireRows.map((_, i) => 
          `($${i*7+1}, $${i*7+2}, $${i*7+3}, $${i*7+4}, $${i*7+5}, $${i*7+6}, $${i*7+7})`
        ).join(',')
        
        await client.query(`
          INSERT INTO bassline_wires (
            network_id, wire_id, 
            from_group_id, from_contact_id,
            to_group_id, to_contact_id,
            wire_type
          ) VALUES ${wireValues}
        `, wireRows.flat())
      }
      
      // Save boundary contacts using batch insert
      await client.query(`
        DELETE FROM bassline_boundary_contacts 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      const boundaryRows: any[] = []
      
      for (const [name, contactId] of state.boundaryContacts.input) {
        boundaryRows.push([networkId, groupId, 'input', name, contactId])
      }
      
      for (const [name, contactId] of state.boundaryContacts.output) {
        boundaryRows.push([networkId, groupId, 'output', name, contactId])
      }
      
      if (boundaryRows.length > 0) {
        const boundaryValues = boundaryRows.map((_, i) => 
          `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`
        ).join(',')
        
        await client.query(`
          INSERT INTO bassline_boundary_contacts (
            network_id, group_id, boundary_type, boundary_name, contact_id
          ) VALUES ${boundaryValues}
        `, boundaryRows.flat())
      }
    })
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    return this.withClient(async (client) => {
      // Run all queries in parallel for better performance
      const [groupResult, attrResult, contactsResult, wiresResult, boundaryResult] = await Promise.all([
        // Check if group exists
        client.query(`
          SELECT group_type, primitive_type 
          FROM bassline_groups_v2 
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId]),
        
        // Load attributes
        client.query(`
          SELECT attribute_key, attribute_value 
          FROM bassline_group_attributes
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId]),
        
        // Load contacts with content - optimized query
        client.query(`
          SELECT c.contact_id, c.contact_type, c.blend_mode, 
                 cc.content_value, cc.content_type
          FROM bassline_contacts_v2 c
          LEFT JOIN bassline_contact_content cc 
            ON c.network_id = cc.network_id 
            AND c.group_id = cc.group_id 
            AND c.contact_id = cc.contact_id
          WHERE c.network_id = $1 AND c.group_id = $2
          ORDER BY c.contact_id
        `, [networkId, groupId]),
        
        // Load wires
        client.query(`
          SELECT wire_id, from_group_id, from_contact_id, 
                 to_group_id, to_contact_id, wire_type
          FROM bassline_wires
          WHERE network_id = $1 
          AND (from_group_id = $2 OR to_group_id = $2)
        `, [networkId, groupId]),
        
        // Load boundary contacts
        client.query(`
          SELECT boundary_type, boundary_name, contact_id
          FROM bassline_boundary_contacts
          WHERE network_id = $1 AND group_id = $2
        `, [networkId, groupId])
      ])
      
      if (groupResult.rows.length === 0) {
        return null
      }
      
      // Process attributes
      const attributes: any = {}
      for (const row of attrResult.rows) {
        attributes[row.attribute_key] = row.attribute_value
      }
      
      // Process contacts - batch JSON parsing for better performance
      const contacts = new Map()
      const jsonParsePromises: Promise<any>[] = []
      const jsonParseIndices: number[] = []
      
      contactsResult.rows.forEach((row, index) => {
        if (row.content_value && row.content_type === 'json') {
          jsonParsePromises.push(
            new Promise(resolve => {
              resolve(deserialize.any(JSON.parse(row.content_value)))
            })
          )
          jsonParseIndices.push(index)
        }
      })
      
      const parsedContents = await Promise.all(jsonParsePromises)
      
      contactsResult.rows.forEach((row, index) => {
        let content = null
        const parseIndex = jsonParseIndices.indexOf(index)
        
        if (parseIndex !== -1) {
          content = parsedContents[parseIndex]
        } else if (row.content_value && row.content_type !== 'json') {
          content = row.content_value
        }
        
        contacts.set(row.contact_id, {
          content,
          blendMode: row.blend_mode
        })
      })
      
      // Process wires
      const wires = new Map()
      for (const row of wiresResult.rows) {
        wires.set(row.wire_id, {
          from: {
            groupId: row.from_group_id,
            contactId: row.from_contact_id
          },
          to: {
            groupId: row.to_group_id,
            contactId: row.to_contact_id
          },
          type: row.wire_type
        })
      }
      
      // Process boundary contacts
      const boundaryContacts = {
        input: new Map(),
        output: new Map()
      }
      
      for (const row of boundaryResult.rows) {
        if (row.boundary_type === 'input') {
          boundaryContacts.input.set(row.boundary_name, row.contact_id)
        } else {
          boundaryContacts.output.set(row.boundary_name, row.contact_id)
        }
      }
      
      const state: GroupState = {
        contacts,
        wires,
        boundaryContacts
      }
      
      // Add optional fields if present
      if (Object.keys(attributes).length > 0) {
        (state as any).attributes = attributes
      }
      
      if (groupResult.rows[0].primitive_type) {
        (state as any).primitiveType = groupResult.rows[0].primitive_type
      }
      
      return state
    })
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`
        DELETE FROM bassline_groups_v2 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
    })
  }
  
  // Network Operations
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Check group limit
      if (state.groups.size > this.limits.maxGroupsPerNetwork) {
        throw new Error(`Network has too many groups (${state.groups.size} > ${this.limits.maxGroupsPerNetwork})`)
      }
      
      await client.query(`
        INSERT INTO bassline_networks_v2 (id, root_group_id)
        VALUES ($1, $2)
        ON CONFLICT (id) 
        DO UPDATE SET root_group_id = $2, updated_at = NOW()
      `, [networkId, state.rootGroup])
      
      // Save all groups
      for (const [groupId, groupState] of state.groups) {
        await this.saveGroupState(networkId, groupId, groupState).then(r => {
          if (!r.ok) throw new Error(r.error.message)
        })
      }
    })
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    return this.withClient(async (client) => {
      const netResult = await client.query(`
        SELECT root_group_id FROM bassline_networks_v2 WHERE id = $1
      `, [networkId])
      
      if (netResult.rows.length === 0) {
        return null
      }
      
      // Load all groups
      const groupsResult = await client.query(`
        SELECT group_id FROM bassline_groups_v2 WHERE network_id = $1
      `, [networkId])
      
      const groups = new Map()
      for (const row of groupsResult.rows) {
        const groupStateResult = await this.loadGroupState(networkId, row.group_id)
        if (groupStateResult.ok && groupStateResult.value) {
          groups.set(row.group_id, groupStateResult.value)
        }
      }
      
      return {
        groups,
        rootGroup: netResult.rows[0].root_group_id
      }
    })
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT id FROM bassline_networks_v2 ORDER BY updated_at DESC
      `)
      
      return result.rows.map(row => brand.networkId(row.id))
    })
  }
  
  async deleteNetwork(networkId: NetworkId): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`DELETE FROM bassline_networks_v2 WHERE id = $1`, [networkId])
    })
  }
  
  async exists(networkId: NetworkId): Promise<Result<boolean, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT 1 FROM bassline_networks_v2 WHERE id = $1 LIMIT 1
      `, [networkId])
      
      return result.rows.length > 0
    })
  }
  
  // Query Operations
  async queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    return this.withClient(async (client) => {
      let query = `
        SELECT DISTINCT g.group_id
        FROM bassline_groups_v2 g
        LEFT JOIN bassline_group_attributes a ON g.network_id = a.network_id AND g.group_id = a.group_id
        WHERE g.network_id = $1
      `
      const params: any[] = [networkId]
      let paramIndex = 2
      
      if (filter.type) {
        params.push(filter.type)
        query += ` AND a.attribute_key = 'type' AND a.attribute_value = $${paramIndex}`
        paramIndex++
      }
      
      if (filter.author) {
        params.push(filter.author)
        query += ` AND a.attribute_key = 'author' AND a.attribute_value = $${paramIndex}`
        paramIndex++
      }
      
      const result = await client.query(query, params)
      
      const groups = []
      for (const row of result.rows) {
        const groupResult = await this.loadGroupState(networkId, row.group_id)
        if (groupResult.ok && groupResult.value) {
          groups.push(groupResult.value)
        }
      }
      
      return groups
    })
  }
  
  // Snapshots
  async saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    return this.withTransaction(async (client) => {
      const stateResult = await this.loadNetworkState(networkId)
      if (!stateResult.ok || !stateResult.value) {
        throw new Error('Network not found')
      }
      
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}`)
      const serialized = serialize.networkState(stateResult.value)
      
      await client.query(`
        INSERT INTO bassline_snapshots_v2 (network_id, snapshot_id, label, state)
        VALUES ($1, $2, $3, $4)
      `, [networkId, snapshotId, label, serialized])
      
      return snapshotId
    })
  }
  
  async loadSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT state FROM bassline_snapshots_v2 
        WHERE network_id = $1 AND snapshot_id = $2
      `, [networkId, snapshotId])
      
      if (result.rows.length === 0) {
        throw new Error('Snapshot not found')
      }
      
      return deserialize.networkState(result.rows[0].state)
    })
  }
  
  async listSnapshots(networkId: NetworkId): Promise<Result<SnapshotInfo[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT snapshot_id, label, created_at, pg_column_size(state) as size_bytes
        FROM bassline_snapshots_v2 
        WHERE network_id = $1
        ORDER BY created_at DESC
      `, [networkId])
      
      return result.rows.map(row => ({
        id: brand.snapshotId(row.snapshot_id),
        networkId,
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
        DELETE FROM bassline_snapshots_v2 
        WHERE network_id = $1 AND snapshot_id = $2
      `, [networkId, snapshotId])
    })
  }
  
  // Statistics
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
          total_content_bytes,
          last_updated
        FROM bassline_network_stats_v2 
        WHERE network_id = $1
      `, [networkId])
      
      if (result.rows.length === 0) {
        // Compute on the fly if materialized view is stale
        const statsResult = await client.query(`
          SELECT 
            COUNT(DISTINCT g.group_id) as group_count,
            COUNT(DISTINCT c.contact_id) as contact_count,
            COALESCE(SUM(cc.content_size), 0) as total_size,
            MAX(g.updated_at) as last_updated
          FROM bassline_groups_v2 g
          LEFT JOIN bassline_contacts_v2 c ON g.network_id = c.network_id AND g.group_id = c.group_id
          LEFT JOIN bassline_contact_content cc ON c.network_id = cc.network_id 
            AND c.group_id = cc.group_id AND c.contact_id = cc.contact_id
          WHERE g.network_id = $1
        `, [networkId])
        
        const row = statsResult.rows[0]
        return {
          groupCount: parseInt(row.group_count) || 0,
          contactCount: parseInt(row.contact_count) || 0,
          snapshotCount: 0,
          totalSize: parseInt(row.total_size) || 0,
          lastUpdated: new Date(row.last_updated)
        }
      }
      
      const row = result.rows[0]
      return {
        groupCount: parseInt(row.group_count) || 0,
        contactCount: parseInt(row.contact_count) || 0,
        snapshotCount: 0,
        totalSize: parseInt(row.total_content_bytes) || 0,
        lastUpdated: new Date(row.last_updated)
      }
    })
  }
  
  async searchGroups(
    networkId: NetworkId,
    searchQuery: string
  ): Promise<Result<GroupState[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT DISTINCT g.group_id
        FROM bassline_groups_v2 g
        LEFT JOIN bassline_group_attributes a ON g.network_id = a.network_id AND g.group_id = a.group_id
        WHERE g.network_id = $1 
        AND (
          g.group_id ILIKE $2 
          OR a.attribute_value ILIKE $2
        )
        LIMIT 100
      `, [networkId, `%${searchQuery}%`])
      
      const groups = []
      for (const row of result.rows) {
        const groupResult = await this.loadGroupState(networkId, row.group_id)
        if (groupResult.ok && groupResult.value) {
          groups.push(groupResult.value)
        }
      }
      
      return groups
    })
  }
  
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
      const result = await client.query(`
        SELECT 
          COUNT(DISTINCT g.group_id) as group_count,
          COALESCE(SUM(cc.content_size), 0) as total_size
        FROM bassline_groups_v2 g
        LEFT JOIN bassline_contacts_v2 c ON g.network_id = c.network_id AND g.group_id = c.group_id
        LEFT JOIN bassline_contact_content cc ON c.network_id = cc.network_id 
          AND c.group_id = cc.group_id AND c.contact_id = cc.contact_id
        WHERE g.network_id = $1
      `, [networkId])
      
      const groupCount = parseInt(result.rows[0].group_count) || 0
      const totalSizeBytes = parseInt(result.rows[0].total_size) || 0
      
      const groupLimitExceeded = groupCount > this.limits.maxGroupsPerNetwork
      const sizeLimitExceeded = false // No total size limit in normalized version
      
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
  
  async initialize(): Promise<Result<void, StorageError>> {
    if (this.initialized) {
      return { ok: true, value: undefined }
    }
    
    try {
      const tableCheckResult = await this.pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'bassline_networks_v2'
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

export function createNormalizedPostgresStorage(config?: PostgresStorageConfig): NetworkStorage {
  return new NormalizedPostgresStorage(config)
}