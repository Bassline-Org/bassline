/**
 * SQLite Storage Driver for Bassline
 * 
 * Optimized for:
 * - Edge deployments (single file, no server)
 * - High throughput (no network overhead)
 * - Sharding (one DB per group/network)
 * - Offline-first applications
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import type { 
  StorageConfig, 
  IStorageError,
  StorageErrorCode,
  GroupState,
  NetworkState,
  Result,
  NetworkId,
  GroupId,
  ContactId,
  SnapshotId,
  Serializable,
  Contact,
  Wire,
  StorageCapabilities,
} from '@bassline/core'
import { NetworkStorage, brand, DriverError } from '@bassline/core'

export interface SQLiteStorageOptions {
  dataDir?: string
  filename?: string
  mode?: 'single' | 'sharded' | 'memory' // single DB, one per network, or in-memory
  walMode?: boolean // Use Write-Ahead Logging
  synchronous?: 'OFF' | 'NORMAL' | 'FULL'
  cacheSize?: number // Pages in cache (negative = KB)
  mmap?: number // Memory-mapped I/O size in bytes
  busyTimeout?: number // Timeout for locks in ms
  memoryShared?: boolean // Use shared in-memory database (accessible across connections)
  pageSize?: number // Database page size (1024, 2048, 4096, 8192, 16384, 32768, 65536)
  tempStore?: 'DEFAULT' | 'FILE' | 'MEMORY' // Where to store temporary tables
}

export class SQLiteStorage extends NetworkStorage {
  sync?(remote: NetworkStorage): Promise<void> {
    throw new Error('Method not implemented.')
  }
  readonly id: string
  readonly name: string = 'sqlite-storage'
  readonly version: string = '1.0.0'
  
  private databases: Map<string, Database.Database> = new Map()
  private options: SQLiteStorageOptions
  private dataDir: string
  private defaultNetworkId: string = 'default'
  
  constructor(config?: StorageConfig & { networkId?: string, options?: SQLiteStorageOptions }) {
    super()
    this.id = `sqlite-storage-${Date.now()}`
    this.defaultNetworkId = config?.networkId || 'default'
    this.options = {
      mode: 'sharded',
      walMode: true,
      synchronous: 'NORMAL',
      cacheSize: -64000, // 64MB cache
      mmap: 256 * 1024 * 1024, // 256MB mmap
      busyTimeout: 5000,
      pageSize: 4096, // Default page size
      tempStore: 'MEMORY', // Keep temp tables in memory
      memoryShared: false,
      ...config?.options
    }
    
    this.dataDir = this.options.dataDir || './data/sqlite'
    
    // Only create directory for file-based modes
    if (this.options.mode !== 'memory' && !existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }
  }
  
  // ============================================================================
  // Database Management
  // ============================================================================
  
  private getDatabase(networkId: NetworkId): Database.Database {
    const key = this.options.mode === 'single' ? 'main' : networkId
    
    if (!this.databases.has(key)) {
      let filename: string
      
      if (this.options.mode === 'memory') {
        // In-memory database
        // Use :memory: for private in-memory DB
        // Use file::memory:?cache=shared for shared in-memory DB
        filename = this.options.memoryShared 
          ? `file:${key}?mode=memory&cache=shared`
          : ':memory:'
      } else if (this.options.mode === 'single') {
        filename = this.options.filename || join(this.dataDir, 'bassline.db')
      } else {
        filename = join(this.dataDir, `${networkId}.db`)
      }
      
      const db = new Database(filename)
      
      // Configure for maximum performance
      if (this.options.mode !== 'memory' && this.options.walMode) {
        db.pragma('journal_mode = WAL')
      }
      
      // Performance optimizations
      db.pragma(`synchronous = ${this.options.synchronous}`)
      db.pragma(`cache_size = ${this.options.cacheSize}`)
      db.pragma(`page_size = ${this.options.pageSize}`)
      db.pragma(`temp_store = ${this.options.tempStore}`)
      db.pragma(`busy_timeout = ${this.options.busyTimeout}`)
      
      // Memory-specific optimizations
      if (this.options.mode === 'memory') {
        // Disable all disk I/O for maximum speed
        db.pragma('journal_mode = OFF')
        db.pragma('synchronous = OFF')
        db.pragma('locking_mode = EXCLUSIVE')
        db.pragma('temp_store = MEMORY')
        // Use larger pages in memory
        db.pragma('page_size = 65536')
      } else {
        // File-based optimizations
        db.pragma(`mmap_size = ${this.options.mmap}`)
      }
      
      // Additional performance optimizations
      db.pragma('foreign_keys = OFF') // We handle integrity in app layer
      db.pragma('automatic_index = OFF') // We create our own indexes
      db.pragma('optimize') // Run ANALYZE
      
      // Create schema
      this.initializeSchema(db)
      
      this.databases.set(key, db)
    }
    
    return this.databases.get(key)!
  }
  
  private initializeSchema(db: Database.Database) {
    db.exec(`
      -- Networks table
      CREATE TABLE IF NOT EXISTS networks (
        id TEXT PRIMARY KEY,
        root_group_id TEXT,
        current_group_id TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );
      
      -- Groups table
      CREATE TABLE IF NOT EXISTS groups (
        network_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        name TEXT,
        boundary_contact_ids TEXT, -- JSON array
        attributes TEXT, -- JSON object
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (network_id, group_id)
      );
      
      -- Contacts table (optimized for bulk operations)
      CREATE TABLE IF NOT EXISTS contacts (
        network_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        content TEXT, -- JSON
        blend_mode TEXT DEFAULT 'accept-last',
        name TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (network_id, group_id, contact_id)
      ) WITHOUT ROWID; -- Clustered index optimization
      
      -- Wires table
      CREATE TABLE IF NOT EXISTS wires (
        network_id TEXT NOT NULL,
        wire_id TEXT NOT NULL,
        from_contact_id TEXT NOT NULL,
        from_group_id TEXT NOT NULL,
        to_contact_id TEXT NOT NULL,
        to_group_id TEXT NOT NULL,
        wire_type TEXT DEFAULT 'bidirectional',
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (network_id, wire_id)
      );
      
      -- Snapshots table
      CREATE TABLE IF NOT EXISTS snapshots (
        network_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        label TEXT,
        snapshot_data TEXT NOT NULL, -- JSON
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (network_id, snapshot_id)
      );
      
      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_contacts_group ON contacts(network_id, group_id);
      CREATE INDEX IF NOT EXISTS idx_wires_from ON wires(network_id, from_group_id, from_contact_id);
      CREATE INDEX IF NOT EXISTS idx_wires_to ON wires(network_id, to_group_id, to_contact_id);
      CREATE INDEX IF NOT EXISTS idx_groups_network ON groups(network_id);
    `)
  }
  
  // ============================================================================
  // NetworkStorage Domain Methods
  // ============================================================================
  
  // ============================================================================
  // NetworkStorage Interface
  // ============================================================================
  
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO contacts (network_id, group_id, contact_id, content, updated_at)
        VALUES (?, ?, ?, ?, unixepoch())
      `)
      
      stmt.run(networkId, groupId, contactId, JSON.stringify(content))
    } catch (error: any) {
      throw new DriverError(
        `Failed to save contact content: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<T | null> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        SELECT content FROM contacts 
        WHERE network_id = ? AND group_id = ? AND contact_id = ?
      `)
      
      const row = stmt.get(networkId, groupId, contactId) as any
      return row ? JSON.parse(row.content) as T : null
    } catch (error: any) {
      throw new DriverError(
        `Failed to load contact content: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      // Use a transaction for atomicity
      const transaction = db.transaction(() => {
        // Save group metadata
        const groupStmt = db.prepare(`
          INSERT OR REPLACE INTO groups (network_id, group_id, name, boundary_contact_ids, attributes, updated_at)
          VALUES (?, ?, ?, ?, ?, unixepoch())
        `)
        
        groupStmt.run(
          networkId,
          groupId,
          state.group.name || null,
          JSON.stringify(state.group.boundaryContactIds || []),
          JSON.stringify({})
        )
        
        // Delete existing contacts for this group (for full replacement)
        const deleteContactsStmt = db.prepare(`
          DELETE FROM contacts WHERE network_id = ? AND group_id = ?
        `)
        deleteContactsStmt.run(networkId, groupId)
        
        // Batch insert all contacts
        if (state.contacts.size > 0) {
          const insertContactStmt = db.prepare(`
            INSERT INTO contacts (network_id, group_id, contact_id, content, blend_mode, name)
            VALUES (?, ?, ?, ?, ?, ?)
          `)
          
          for (const [contactId, contact] of state.contacts) {
            insertContactStmt.run(
              networkId,
              groupId,
              contactId,
              JSON.stringify(contact.content),
              contact.blendMode || 'accept-last',
              contact.name || null
            )
          }
        }
        
        // Delete existing wires for this group
        const deleteWiresStmt = db.prepare(`
          DELETE FROM wires WHERE network_id = ? AND (from_group_id = ? OR to_group_id = ?)
        `)
        deleteWiresStmt.run(networkId, groupId, groupId)
        
        // Batch insert all wires
        if (state.wires && state.wires.size > 0) {
          const insertWireStmt = db.prepare(`
            INSERT INTO wires (network_id, wire_id, from_contact_id, from_group_id, to_contact_id, to_group_id, wire_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          
          for (const [wireId, wire] of state.wires) {
            insertWireStmt.run(
              networkId,
              wireId,
              wire.fromId,
              groupId, // Assuming wires are within the same group for now
              wire.toId,
              groupId,
              wire.type || 'bidirectional'
            )
          }
        }
      })
      
      transaction()
    } catch (error: any) {
      throw new DriverError(
        `Failed to save group state: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<GroupState | null> {
      const db = this.getDatabase(networkId)
      
      // Load group metadata
      const groupStmt = db.prepare(`
        SELECT * FROM groups WHERE network_id = ? AND group_id = ?
      `)
      const groupRow = groupStmt.get(networkId, groupId) as any
      
      if (!groupRow) {
        return null
      }
      
      // Load contacts
      const contactsStmt = db.prepare(`
        SELECT * FROM contacts WHERE network_id = ? AND group_id = ?
      `)
      const contactRows = contactsStmt.all(networkId, groupId) as any[]
      
      const contacts = new Map<ContactId, Contact>()
      for (const row of contactRows) {
        contacts.set(row.contact_id, {
          id: row.contact_id,
          groupId: groupId,
          content: JSON.parse(row.content),
          blendMode: row.blend_mode,
          name: row.name
        })
      }
      
      // Load wires
      const wiresStmt = db.prepare(`
        SELECT * FROM wires WHERE network_id = ? AND (from_group_id = ? OR to_group_id = ?)
      `)
      const wireRows = wiresStmt.all(networkId, groupId, groupId) as any[]
      
      const wires = new Map()
      for (const row of wireRows) {
        wires.set(row.wire_id, {
          id: row.wire_id,
          fromId: row.from_contact_id,
          toId: row.to_contact_id,
          type: row.wire_type
        })
      }
      
      return {
          group: {
            id: groupId,
            name: groupRow.name,
            contactIds: Array.from(contacts.keys()),
            wireIds: Array.from(wires.keys()),
            subgroupIds: [],
            boundaryContactIds: JSON.parse(groupRow.boundary_contact_ids || '[]')
          },
          contacts,
          wires
        }
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      const transaction = db.transaction(() => {
        // Delete contacts
        db.prepare('DELETE FROM contacts WHERE network_id = ? AND group_id = ?')
          .run(networkId, groupId)
        
        // Delete wires
        db.prepare('DELETE FROM wires WHERE network_id = ? AND (from_group_id = ? OR to_group_id = ?)')
          .run(networkId, groupId, groupId)
        
        // Delete group
        db.prepare('DELETE FROM groups WHERE network_id = ? AND group_id = ?')
          .run(networkId, groupId)
      })
      
      transaction()
      
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete group: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO networks (id, root_group_id, current_group_id, updated_at)
        VALUES (?, ?, ?, unixepoch())
      `)
      
      stmt.run(networkId, state.rootGroupId, state.currentGroupId)
      
    } catch (error: any) {
      throw new DriverError(
        `Failed to save network state: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<NetworkState | null> {
    try {
      const db = this.getDatabase(networkId)
      
      const networkStmt = db.prepare(`
        SELECT * FROM networks WHERE id = ?
      `)
      const networkRow = networkStmt.get(networkId) as any
      
      if (!networkRow) {
        return null
      }
      
      // Load all groups
      const groupsStmt = db.prepare(`
        SELECT group_id FROM groups WHERE network_id = ?
      `)
      const groupRows = groupsStmt.all(networkId) as any[]
      
      const groups = new Map()
      const groupStates = await Promise.all(
        groupRows.map(row => this.loadGroupState(networkId, row.group_id))
      )
      
      for (let i = 0; i < groupRows.length; i++) {
        const groupState = groupStates[i]
        if (groupState) {
          groups.set(groupRows[i].group_id, groupState)
        }
      }
      
      return {
          networkId,
          groups,
          wires: new Map(),
          currentGroupId: networkRow.current_group_id,
          rootGroupId: networkRow.root_group_id
      } as NetworkState
    } catch (error: any) {
      throw new DriverError(
        `Failed to load network state: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async listNetworks(): Promise<NetworkId[]> {
    try {
      if (this.options.mode === 'single') {
        const db = this.getDatabase(brand.networkId('main'))
        const stmt = db.prepare('SELECT id FROM networks ORDER BY updated_at DESC')
        const rows = stmt.all() as any[]
        return rows.map(r => brand.networkId(r.id))
      } else {
        // In sharded mode, list all .db files
        const { readdirSync } = await import('fs')
        const files = readdirSync(this.dataDir)
        const networkIds = files
          .filter(f => f.endsWith('.db'))
          .map(f => brand.networkId(f.replace('.db', '')))
        return networkIds
      }
    } catch (error: any) {
      throw new DriverError(
        `Failed to list networks: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async deleteNetwork(networkId: NetworkId): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM contacts WHERE network_id = ?').run(networkId)
        db.prepare('DELETE FROM wires WHERE network_id = ?').run(networkId)
        db.prepare('DELETE FROM groups WHERE network_id = ?').run(networkId)
        db.prepare('DELETE FROM snapshots WHERE network_id = ?').run(networkId)
        db.prepare('DELETE FROM networks WHERE id = ?').run(networkId)
      })
      
      transaction()
      
      // If sharded, close and delete the database file
      if (this.options.mode === 'sharded') {
        db.close()
        this.databases.delete(networkId)
        
        const { unlinkSync } = await import('fs')
        const filename = join(this.dataDir, `${networkId}.db`)
        try {
          unlinkSync(filename)
          unlinkSync(`${filename}-shm`)
          unlinkSync(`${filename}-wal`)
        } catch (e) {
          // Files might not exist
        }
      }
      
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete network: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async exists(networkId: NetworkId): Promise<boolean> {
    try {
      if (this.options.mode === 'single') {
        const db = this.getDatabase(networkId)
        const stmt = db.prepare('SELECT 1 FROM networks WHERE id = ? LIMIT 1')
        const row = stmt.get(networkId)
        return !!row
      } else {
        const { existsSync } = await import('fs')
        const filename = join(this.dataDir, `${networkId}.db`)
        return existsSync(filename)
      }
    } catch (error: any) {
      throw new DriverError(
        `Failed to check network existence: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  // Stub implementations for missing interface methods
  async queryGroups(networkId: NetworkId, filter: any): Promise<GroupState[]> {
    return []
  }
  
  async saveSnapshot(networkId: NetworkId, label?: string): Promise<SnapshotId> {
    try {
      const db = this.getDatabase(networkId)
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}`)
      
      // Load full network state
      const networkState = await this.loadNetworkState(networkId)
      if (!networkState) {
        throw new DriverError(
          `Failed to load network state for snapshot: network ${networkId} not found`,
          { fatal: false }
        )
      }
      
      const stmt = db.prepare(`
        INSERT INTO snapshots (network_id, snapshot_id, label, snapshot_data)
        VALUES (?, ?, ?, ?)
      `)
      
      stmt.run(networkId, snapshotId, label || null, JSON.stringify(networkState))
      
      return snapshotId
    } catch (error: any) {
      throw new DriverError(
        `Failed to save snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async loadSnapshot(networkId: NetworkId, snapshotId: SnapshotId): Promise<NetworkState> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        SELECT snapshot_data FROM snapshots 
        WHERE network_id = ? AND snapshot_id = ?
      `)
      
      const row = stmt.get(networkId, snapshotId) as any
      if (!row) {
        throw new DriverError(
          'Snapshot not found',
          { fatal: false }
        )
      }
      
      return JSON.parse(row.snapshot_data)
    } catch (error: any) {
      if (error instanceof DriverError) {
        throw error
      }
      throw new DriverError(
        `Failed to load snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async listSnapshots(networkId: NetworkId): Promise<Array<{ id: SnapshotId; label?: string; createdAt: Date }>> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        SELECT snapshot_id, label, created_at 
        FROM snapshots 
        WHERE network_id = ? 
        ORDER BY created_at DESC
      `)
      
      const rows = stmt.all(networkId) as any[]
      
      return rows.map(row => ({
        id: row.snapshot_id,
        label: row.label,
        createdAt: new Date(row.created_at * 1000)
      }))
    } catch (error: any) {
      throw new DriverError(
        `Failed to list snapshots: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async deleteSnapshot(networkId: NetworkId, snapshotId: SnapshotId): Promise<void> {
    try {
      const db = this.getDatabase(networkId)
      
      const stmt = db.prepare(`
        DELETE FROM snapshots 
        WHERE network_id = ? AND snapshot_id = ?
      `)
      
      stmt.run(networkId, snapshotId)
      
    } catch (error: any) {
      throw new DriverError(
        `Failed to delete snapshot: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  async initialize(): Promise<void> {
    // SQLite doesn't need explicit initialization
  }
  
  async close(): Promise<void> {
    try {
      for (const db of this.databases.values()) {
        db.close()
      }
      this.databases.clear()
    } catch (error: any) {
      throw new DriverError(
        `Failed to close SQLite databases: ${error.message}`,
        { fatal: true, originalError: error }
      )
    }
  }

  // ============================================================================
  // Abstract method implementations for NetworkStorage
  // ============================================================================
  
  getDefaultNetworkId(): NetworkId {
    return brand.networkId(this.defaultNetworkId)
  }
  
  getCapabilities(): StorageCapabilities {
    return {
      supportsBatching: true,
      supportsTransactions: true,
      supportsStreaming: false,
      maxBatchSize: 10000,
      persistent: this.options.mode !== 'memory'
    }
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      // Try to get the main database
      const db = this.getDatabase(brand.networkId(this.defaultNetworkId))
      
      // Run a simple query to check if database is accessible
      db.prepare('SELECT 1').get()
      
      return true
    } catch (error: any) {
      throw new DriverError(`SQLite unhealthy: ${error.message}`, { fatal: true })
    }
  }
}