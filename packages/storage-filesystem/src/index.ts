/**
 * Filesystem storage implementation for Bassline
 * 
 * Provides persistent storage using the filesystem with strong domain types
 * and Result-based error handling
 */

import { promises as fs } from 'fs'
import path from 'path'
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
import { brand } from '@bassline/core'

interface FilesystemStorageConfig extends StorageConfig {
  options?: {
    basePath?: string
    compression?: boolean
    encoding?: BufferEncoding
  }
}

export class FilesystemStorage implements NetworkStorage {
  private readonly basePath: string
  private readonly encoding: BufferEncoding
  private readonly compression: boolean
  
  constructor(config?: FilesystemStorageConfig) {
    this.basePath = config?.options?.basePath || path.join(process.cwd(), '.bassline-storage')
    this.encoding = config?.options?.encoding || 'utf-8'
    this.compression = config?.options?.compression || false
  }
  
  // ============================================================================
  // Helper Methods
  // ============================================================================
  
  private networkPath(networkId: NetworkId): string {
    return path.join(this.basePath, 'networks', networkId)
  }
  
  private groupPath(networkId: NetworkId, groupId: GroupId): string {
    return path.join(this.networkPath(networkId), 'groups', `${groupId}.json`)
  }
  
  private contactPath(networkId: NetworkId, groupId: GroupId, contactId: ContactId): string {
    return path.join(this.networkPath(networkId), 'contacts', groupId, `${contactId}.json`)
  }
  
  private networkStatePath(networkId: NetworkId): string {
    return path.join(this.networkPath(networkId), 'network.json')
  }
  
  private snapshotPath(networkId: NetworkId, snapshotId: SnapshotId): string {
    return path.join(this.networkPath(networkId), 'snapshots', `${snapshotId}.json`)
  }
  
  private async ensureDirectory(dirPath: string): Promise<Result<void, StorageError>> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { ok: true, value: undefined }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to create directory: ${dirPath}`,
          details: error
        }
      }
    }
  }
  
  private async writeFile<T>(
    filePath: string, 
    data: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    try {
      const dir = path.dirname(filePath)
      const ensureDirResult = await this.ensureDirectory(dir)
      if (!ensureDirResult.ok) return ensureDirResult
      
      const content = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, content, this.encoding)
      
      return { ok: true, value: undefined }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: `Failed to write file: ${filePath}`,
          details: error
        }
      }
    }
  }
  
  private async readFile<T>(filePath: string): Promise<Result<T | null, StorageError>> {
    try {
      const content = await fs.readFile(filePath, this.encoding)
      const data = JSON.parse(content) as T
      return { ok: true, value: data }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { ok: true, value: null }
      }
      
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: `Failed to read file: ${filePath}`,
          details: error
        }
      }
    }
  }
  
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
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
    const filePath = this.contactPath(networkId, groupId, contactId)
    return this.writeFile(filePath, { content, updatedAt: new Date().toISOString() })
  }
  
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    const filePath = this.contactPath(networkId, groupId, contactId)
    const result = await this.readFile<{ content: T; updatedAt: string }>(filePath)
    
    if (!result.ok) return result
    if (result.value === null) return { ok: true, value: null }
    
    return { ok: true, value: result.value.content }
  }
  
  // Group Operations  
  async saveGroupState(
    networkId: NetworkId, 
    groupId: GroupId, 
    state: GroupState
  ): Promise<Result<void, StorageError>> {
    const filePath = this.groupPath(networkId, groupId)
    return this.writeFile(filePath, { ...state, updatedAt: new Date().toISOString() })
  }
  
  async loadGroupState(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<GroupState | null, StorageError>> {
    const filePath = this.groupPath(networkId, groupId)
    const result = await this.readFile<GroupState & { updatedAt: string }>(filePath)
    
    if (!result.ok) return result
    if (result.value === null) return { ok: true, value: null }
    
    // Remove storage metadata
    const { updatedAt, ...groupState } = result.value
    return { ok: true, value: groupState as GroupState }
  }
  
  async deleteGroup(
    networkId: NetworkId, 
    groupId: GroupId
  ): Promise<Result<void, StorageError>> {
    try {
      const filePath = this.groupPath(networkId, groupId)
      await fs.unlink(filePath)
      
      // Also delete contact directory for this group
      const contactDir = path.join(this.networkPath(networkId), 'contacts', groupId)
      if (await this.fileExists(contactDir)) {
        await fs.rm(contactDir, { recursive: true, force: true })
      }
      
      return { ok: true, value: undefined }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { ok: true, value: undefined } // Already deleted
      }
      
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to delete group: ${groupId}`,
          details: error
        }
      }
    }
  }
  
  // Network Operations
  async saveNetworkState(
    networkId: NetworkId, 
    state: NetworkState
  ): Promise<Result<void, StorageError>> {
    const filePath = this.networkStatePath(networkId)
    return this.writeFile(filePath, { ...state, updatedAt: new Date().toISOString() })
  }
  
  async loadNetworkState(
    networkId: NetworkId
  ): Promise<Result<NetworkState | null, StorageError>> {
    const filePath = this.networkStatePath(networkId)
    const result = await this.readFile<NetworkState & { updatedAt: string }>(filePath)
    
    if (!result.ok) return result
    if (result.value === null) return { ok: true, value: null }
    
    // Remove storage metadata
    const { updatedAt, ...networkState } = result.value
    return { ok: true, value: networkState as NetworkState }
  }
  
  async listNetworks(): Promise<Result<NetworkId[], StorageError>> {
    try {
      const networksDir = path.join(this.basePath, 'networks')
      
      if (!(await this.fileExists(networksDir))) {
        return { ok: true, value: [] }
      }
      
      const entries = await fs.readdir(networksDir, { withFileTypes: true })
      const networkIds = entries
        .filter(entry => entry.isDirectory())
        .map(entry => brand.networkId(entry.name))
      
      return { ok: true, value: networkIds }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: 'Failed to list networks',
          details: error
        }
      }
    }
  }
  
  async deleteNetwork(
    networkId: NetworkId
  ): Promise<Result<void, StorageError>> {
    try {
      const networkDir = this.networkPath(networkId)
      if (await this.fileExists(networkDir)) {
        await fs.rm(networkDir, { recursive: true, force: true })
      }
      return { ok: true, value: undefined }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to delete network: ${networkId}`,
          details: error
        }
      }
    }
  }
  
  async exists(
    networkId: NetworkId
  ): Promise<Result<boolean, StorageError>> {
    try {
      const networkDir = this.networkPath(networkId)
      const exists = await this.fileExists(networkDir)
      return { ok: true, value: exists }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to check network existence: ${networkId}`,
          details: error
        }
      }
    }
  }
  
  // Query Operations
  async queryGroups(
    networkId: NetworkId, 
    filter: QueryFilter
  ): Promise<Result<GroupState[], StorageError>> {
    try {
      const groupsDir = path.join(this.networkPath(networkId), 'groups')
      
      if (!(await this.fileExists(groupsDir))) {
        return { ok: true, value: [] }
      }
      
      const files = await fs.readdir(groupsDir)
      const results: GroupState[] = []
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        const filePath = path.join(groupsDir, file)
        const groupResult = await this.readFile<GroupState & { updatedAt: string }>(filePath)
        
        if (!groupResult.ok) continue
        if (groupResult.value === null) continue
        
        const { updatedAt, ...groupState } = groupResult.value
        const group = groupState as GroupState
        
        // Apply filters
        let matches = true
        
        if (filter.attributes) {
          for (const [key, value] of Object.entries(filter.attributes)) {
            if (group.group.attributes?.[key] !== value) {
              matches = false
              break
            }
          }
        }
        
        if (filter.author && matches) {
          const author = group.group.attributes?.['bassline.author'] || 
                        group.group.attributes?.author
          if (author !== filter.author) {
            matches = false
          }
        }
        
        if (filter.tags && matches) {
          const tags = group.group.attributes?.['bassline.tags'] || 
                      group.group.attributes?.tags || []
          const tagSet = new Set(tags)
          if (!filter.tags.every(tag => tagSet.has(tag))) {
            matches = false
          }
        }
        
        if (filter.type && matches) {
          const type = group.group.attributes?.['bassline.type'] || 
                      group.group.attributes?.type
          if (type !== filter.type) {
            matches = false
          }
        }
        
        if (matches) {
          results.push(group)
        }
      }
      
      return { ok: true, value: results }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to query groups in network: ${networkId}`,
          details: error
        }
      }
    }
  }
  
  // Versioning & Snapshots
  async saveSnapshot(
    networkId: NetworkId, 
    label?: string
  ): Promise<Result<SnapshotId, StorageError>> {
    try {
      // Load current network state
      const stateResult = await this.loadNetworkState(networkId)
      if (!stateResult.ok) return stateResult
      if (stateResult.value === null) {
        return {
          ok: false,
          error: {
            code: 'NETWORK_NOT_FOUND',
            message: `Network ${networkId} not found`
          }
        }
      }
      
      // Generate snapshot ID
      const snapshotId = brand.snapshotId(`snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      
      // Create snapshot
      const snapshot = {
        id: snapshotId,
        networkId,
        label,
        state: stateResult.value,
        createdAt: new Date().toISOString()
      }
      
      // Save snapshot
      const filePath = this.snapshotPath(networkId, snapshotId)
      const writeResult = await this.writeFile(filePath, snapshot)
      
      if (!writeResult.ok) return writeResult
      
      return { ok: true, value: snapshotId }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: `Failed to save snapshot for network: ${networkId}`,
          details: error
        }
      }
    }
  }
  
  async loadSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<NetworkState, StorageError>> {
    const filePath = this.snapshotPath(networkId, snapshotId)
    const result = await this.readFile<{
      id: SnapshotId
      networkId: NetworkId
      state: NetworkState
      createdAt: string
      label?: string
    }>(filePath)
    
    if (!result.ok) return result
    if (result.value === null) {
      return {
        ok: false,
        error: {
          code: 'SNAPSHOT_NOT_FOUND',
          message: `Snapshot ${snapshotId} not found for network ${networkId}`
        }
      }
    }
    
    return { ok: true, value: result.value.state }
  }
  
  async listSnapshots(
    networkId: NetworkId
  ): Promise<Result<SnapshotInfo[], StorageError>> {
    try {
      const snapshotsDir = path.join(this.networkPath(networkId), 'snapshots')
      
      if (!(await this.fileExists(snapshotsDir))) {
        return { ok: true, value: [] }
      }
      
      const files = await fs.readdir(snapshotsDir)
      const results: SnapshotInfo[] = []
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        const filePath = path.join(snapshotsDir, file)
        const snapshotResult = await this.readFile<{
          id: SnapshotId
          networkId: NetworkId
          label?: string
          createdAt: string
          state: NetworkState
        }>(filePath)
        
        if (!snapshotResult.ok || snapshotResult.value === null) continue
        
        const snapshot = snapshotResult.value
        const stats = await fs.stat(filePath)
        
        results.push({
          id: snapshot.id,
          networkId: snapshot.networkId,
          label: snapshot.label,
          createdAt: new Date(snapshot.createdAt),
          size: stats.size
        })
      }
      
      // Sort by creation date (newest first)
      results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      
      return { ok: true, value: results }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to list snapshots for network: ${networkId}`,
          details: error
        }
      }
    }
  }
  
  async deleteSnapshot(
    networkId: NetworkId, 
    snapshotId: SnapshotId
  ): Promise<Result<void, StorageError>> {
    try {
      const filePath = this.snapshotPath(networkId, snapshotId)
      await fs.unlink(filePath)
      return { ok: true, value: undefined }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { ok: true, value: undefined } // Already deleted
      }
      
      return {
        ok: false,
        error: {
          code: 'STORAGE_PERMISSION_ERROR',
          message: `Failed to delete snapshot: ${snapshotId}`,
          details: error
        }
      }
    }
  }
  
  // Lifecycle
  async initialize(): Promise<Result<void, StorageError>> {
    return this.ensureDirectory(this.basePath)
  }
  
  async close(): Promise<Result<void, StorageError>> {
    // Filesystem storage doesn't need explicit cleanup
    return { ok: true, value: undefined }
  }
}

// Factory function
export function createFilesystemStorage(config?: FilesystemStorageConfig): NetworkStorage {
  return new FilesystemStorage(config)
}