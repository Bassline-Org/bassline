/**
 * Optimized PostgreSQL storage implementation using proper relational model
 * 
 * Key optimizations:
 * 1. Only saves changed data, not entire group state
 * 2. Uses batch operations with unnest for bulk inserts
 * 3. Uses the view for loading group state
 * 4. Parallel operations with Promise.all
 */

import { Pool, PoolClient } from 'pg'
import type { 
  NetworkStorage, 
  StorageConfig, 
  StorageError,
  GroupState,
  NetworkState,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  Serializable,
  Group,
  Contact,
  Wire
} from '@bassline/core'
import { brand } from '@bassline/core'

export class OptimizedPostgresStorage implements NetworkStorage {
  private pool: Pool
  private initialized = false
  
  constructor(config?: StorageConfig) {
    const options = config?.options || {}
    
    this.pool = new Pool({
      host: options.host || 'localhost',
      port: options.port || 5432,
      database: options.database || 'bassline',
      user: options.user || process.env.USER,
      password: options.password,
      max: options.poolSize || 20,
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
      if (client) {
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
  // Optimized Contact Operations
  // ============================================================================
  
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      // Single upsert, only updates if content changed
      await client.query(`
        INSERT INTO bassline_contacts (network_id, group_id, contact_id, content)
        VALUES ($1, $2, $3, $4::jsonb)
        ON CONFLICT (network_id, group_id, contact_id) 
        DO UPDATE SET 
          content = $4::jsonb,
          updated_at = NOW()
        WHERE bassline_contacts.content IS DISTINCT FROM $4::jsonb
      `, [networkId, groupId, contactId, JSON.stringify(content)])
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
      
      return result.rows[0].content as T
    })
  }
  
  // ============================================================================
  // Optimized Batch Operations
  // ============================================================================
  
  async batchSaveContacts(
    networkId: NetworkId,
    groupId: GroupId,
    contacts: Map<ContactId, Contact>
  ): Promise<Result<void, StorageError>> {
    if (contacts.size === 0) return { ok: true, value: undefined }
    
    return this.withClient(async (client) => {
      // Prepare arrays for unnest
      const contactIds: string[] = []
      const contents: any[] = []
      const blendModes: string[] = []
      
      for (const [contactId, contact] of contacts) {
        contactIds.push(contactId)
        contents.push(JSON.stringify(contact.content))
        blendModes.push(contact.blendMode || 'accept-last')
      }
      
      // Single query to upsert all contacts
      await client.query(`
        INSERT INTO bassline_contacts (
          network_id, group_id, contact_id, content, blend_mode
        )
        SELECT 
          $1, $2, 
          unnest($3::text[]), 
          unnest($4::jsonb[]),
          unnest($5::text[])
        ON CONFLICT (network_id, group_id, contact_id)
        DO UPDATE SET 
          content = EXCLUDED.content,
          blend_mode = EXCLUDED.blend_mode,
          updated_at = NOW()
        WHERE 
          bassline_contacts.content IS DISTINCT FROM EXCLUDED.content OR
          bassline_contacts.blend_mode IS DISTINCT FROM EXCLUDED.blend_mode
      `, [networkId, groupId, contactIds, contents, blendModes])
    })
  }
  
  // ============================================================================
  // Optimized Group Operations  
  // ============================================================================
  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    return this.withTransaction(async (client) => {
      // Parallel operations using Promise.all
      const operations: Promise<any>[] = []
      
      // 1. Save group metadata (only metadata, not contacts!)
      operations.push(
        client.query(`
          INSERT INTO bassline_groups (
            network_id, group_id, name, boundary_contact_ids, attributes
          )
          VALUES ($1, $2, $3, $4, $5::jsonb)
          ON CONFLICT (network_id, group_id) 
          DO UPDATE SET 
            name = $3,
            boundary_contact_ids = $4,
            attributes = $5::jsonb,
            updated_at = NOW()
          WHERE 
            bassline_groups.name IS DISTINCT FROM $3 OR
            bassline_groups.boundary_contact_ids IS DISTINCT FROM $4 OR
            bassline_groups.attributes IS DISTINCT FROM $5::jsonb
        `, [
          networkId, 
          groupId, 
          state.group.name || null,
          state.group.boundaryContactIds || [],
          {}
        ])
      )
      
      // 2. Batch save contacts if any
      if (state.contacts.size > 0) {
        const contactIds: string[] = []
        const contents: any[] = []
        const blendModes: string[] = []
        
        for (const [contactId, contact] of state.contacts) {
          contactIds.push(contactId)
          contents.push(JSON.stringify(contact.content))
          blendModes.push(contact.blendMode || 'accept-last')
        }
        
        operations.push(
          client.query(`
            INSERT INTO bassline_contacts (
              network_id, group_id, contact_id, content, blend_mode
            )
            SELECT 
              $1, $2, 
              unnest($3::text[]), 
              unnest($4::jsonb[]),
              unnest($5::text[])
            ON CONFLICT (network_id, group_id, contact_id)
            DO UPDATE SET 
              content = EXCLUDED.content,
              blend_mode = EXCLUDED.blend_mode,
              updated_at = NOW()
            WHERE 
              bassline_contacts.content IS DISTINCT FROM EXCLUDED.content OR
              bassline_contacts.blend_mode IS DISTINCT FROM EXCLUDED.blend_mode
          `, [networkId, groupId, contactIds, contents, blendModes])
        )
      }
      
      // 3. Batch save wires if any
      if (state.wires && state.wires.size > 0) {
        const wireIds: string[] = []
        const fromContactIds: string[] = []
        const toContactIds: string[] = []
        const wireTypes: string[] = []
        
        for (const [wireId, wire] of state.wires) {
          wireIds.push(wireId)
          fromContactIds.push(wire.fromId)
          toContactIds.push(wire.toId)
          wireTypes.push(wire.type || 'bidirectional')
        }
        
        operations.push(
          client.query(`
            INSERT INTO bassline_wires (
              network_id, wire_id, 
              from_contact_id, from_group_id,
              to_contact_id, to_group_id,
              wire_type
            )
            SELECT 
              $1, 
              unnest($2::text[]),
              unnest($3::text[]), $4,
              unnest($5::text[]), $6,
              unnest($7::text[])
            ON CONFLICT (network_id, wire_id)
            DO UPDATE SET 
              from_contact_id = EXCLUDED.from_contact_id,
              to_contact_id = EXCLUDED.to_contact_id,
              wire_type = EXCLUDED.wire_type
          `, [networkId, wireIds, fromContactIds, groupId, toContactIds, groupId, wireTypes])
        )
      }
      
      // Execute all operations in parallel
      await Promise.all(operations)
    })
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    return this.withClient(async (client) => {
      // Use the VIEW for efficient loading!
      const result = await client.query(`
        SELECT 
          group_id, name, boundary_contact_ids, attributes,
          contacts, wires
        FROM bassline_group_states
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      
      if (result.rows.length === 0) {
        return null
      }
      
      const row = result.rows[0]
      
      // Parse the aggregated JSON back into Maps
      const contacts = new Map()
      for (const contact of row.contacts || []) {
        contacts.set(contact.contact_id, {
          id: contact.contact_id,
          content: contact.content,
          blendMode: contact.blend_mode,
          name: contact.name
        })
      }
      
      const wires = new Map()
      for (const wire of row.wires || []) {
        wires.set(wire.wire_id, {
          id: wire.wire_id,
          fromId: wire.from_contact_id,
          toId: wire.to_contact_id,
          type: wire.wire_type
        })
      }
      
      return {
        group: {
          id: groupId,
          name: row.name,
          contactIds: Array.from(contacts.keys()),
          wireIds: Array.from(wires.keys()),
          subgroupIds: [],
          boundaryContactIds: row.boundary_contact_ids || []
        },
        contacts,
        wires
      }
    })
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`
        DELETE FROM bassline_groups 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
    })
  }
  
  // ============================================================================
  // Network Operations (simplified)
  // ============================================================================
  
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
      await client.query(`
        INSERT INTO bassline_networks (id)
        VALUES ($1)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      `, [networkId])
    })
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT id FROM bassline_networks WHERE id = $1
      `, [networkId])
      
      if (result.rows.length === 0) {
        return null
      }
      
      // Load groups
      const groupsResult = await client.query(`
        SELECT group_id FROM bassline_groups 
        WHERE network_id = $1
      `, [networkId])
      
      const groups = new Map()
      for (const row of groupsResult.rows) {
        const groupState = await this.loadGroupState(networkId, brand.groupId(row.group_id))
        if (groupState.ok && groupState.value) {
          groups.set(row.group_id, groupState.value)
        }
      }
      
      return {
        networkId,
        groups,
        wires: new Map(),
        currentGroupId: 'root',
        rootGroupId: 'root'
      } as NetworkState
    })
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    return this.withClient(async (client) => {
      const result = await client.query(`
        SELECT id FROM bassline_networks ORDER BY updated_at DESC
      `)
      
      return result.rows.map(row => brand.networkId(row.id))
    })
  }
  
  async deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>> {
    return this.withClient(async (client) => {
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
  
  // Stubs for interface compliance
  async queryGroups(networkId: NetworkId, filter: any): Promise<Result<GroupState[], StorageError>> {
    return { ok: true, value: [] }
  }
  
  async saveSnapshot(networkId: NetworkId, label?: string): Promise<Result<any, StorageError>> {
    return { ok: true, value: brand.snapshotId('stub') }
  }
  
  async loadSnapshot(networkId: NetworkId, snapshotId: any): Promise<Result<NetworkState, StorageError>> {
    return { ok: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented' } }
  }
  
  async listSnapshots(networkId: NetworkId): Promise<Result<any[], StorageError>> {
    return { ok: true, value: [] }
  }
  
  async deleteSnapshot(networkId: NetworkId, snapshotId: any): Promise<Result<void, StorageError>> {
    return { ok: true, value: undefined }
  }
  
  // Lifecycle
  async initialize(): Promise<Result<void, StorageError>> {
    if (this.initialized) {
      return { ok: true, value: undefined }
    }
    
    try {
      // Just check connection
      await this.pool.query('SELECT 1')
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