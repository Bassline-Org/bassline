/**
 * Filesystem Append-Only Storage for Propagation Networks
 * 
 * Key innovations:
 * - Each version is a separate file (true append-only)
 * - Atomic writes using temp files + rename
 * - Natural sharding through directory structure
 * - Zero lock contention for parallel writes
 */

import * as fs from 'fs/promises'
import * as path from 'path'
// Removed unused imports - createReadStream, createWriteStream
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

interface FilesystemStorageConfig {
  basePath?: string
  compression?: 'none' | 'gzip'  // Future: compress old versions
  versioning?: {
    keepVersions?: number        // How many versions to keep
    archiveOldVersions?: boolean // Move old versions to archive dir
  }
  performance?: {
    useSymlinks?: boolean        // Use symlinks for 'latest' (faster reads)
    bufferWrites?: boolean       // Buffer writes in memory before flushing
    parallelism?: number         // Max parallel file operations
  }
}

export class FilesystemAppendOnlyStorage implements Partial<NetworkStorage> {
  private basePath: string
  private config: FilesystemStorageConfig
  private versionCounters: Map<string, number> = new Map()
  
  constructor(config: FilesystemStorageConfig = {}) {
    this.config = config
    this.basePath = config.basePath || './bassline-data'
  }
  
  /**
   * Initialize storage directory structure
   */
  async initialize(): Promise<Result<void, StorageError>> {
    try {
      await fs.mkdir(this.basePath, { recursive: true })
      await fs.mkdir(path.join(this.basePath, 'networks'), { recursive: true })
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Get the directory path for a contact
   */
  private getContactPath(networkId: NetworkId, groupId: GroupId, contactId: ContactId): string {
    return path.join(
      this.basePath,
      'networks',
      networkId,
      'groups',
      groupId,
      'contacts',
      contactId
    )
  }
  
  /**
   * Get next version number for a contact
   */
  private async getNextVersion(networkId: NetworkId, groupId: GroupId, contactId: ContactId): Promise<number> {
    const key = `${networkId}:${groupId}:${contactId}`
    
    // Check in-memory counter first
    if (this.versionCounters.has(key)) {
      const next = this.versionCounters.get(key)! + 1
      this.versionCounters.set(key, next)
      return next
    }
    
    // Otherwise, check filesystem
    const contactPath = this.getContactPath(networkId, groupId, contactId)
    
    try {
      const files = await fs.readdir(contactPath)
      const versionFiles = files.filter(f => f.match(/^v\d+\.json$/))
      const maxVersion = versionFiles.reduce((max, file) => {
        const version = parseInt(file.slice(1, -5), 10)
        return Math.max(max, version)
      }, 0)
      
      const next = maxVersion + 1
      this.versionCounters.set(key, next)
      return next
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Directory doesn't exist, this is version 1
        this.versionCounters.set(key, 1)
        return 1
      }
      throw error
    }
  }
  
  /**
   * Save contact content - APPEND ONLY, creates new version file
   */
  async saveContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId, 
    content: Serializable<T>
  ): Promise<Result<void, StorageError>> {
    try {
      const contactPath = this.getContactPath(networkId, groupId, contactId)
      
      // Ensure directory exists
      await fs.mkdir(contactPath, { recursive: true })
      
      // Get next version number
      const version = await this.getNextVersion(networkId, groupId, contactId)
      const versionFile = `v${version.toString().padStart(8, '0')}.json`
      const versionPath = path.join(contactPath, versionFile)
      
      // Serialize content
      const serialized = JSON.stringify({
        version,
        timestamp: Date.now(),
        content: serialize.any(content)
      }, null, 2)
      
      // Atomic write: write to temp file, then rename
      const tempPath = `${versionPath}.tmp`
      await fs.writeFile(tempPath, serialized, 'utf8')
      await fs.rename(tempPath, versionPath)
      
      // Update 'latest' symlink if configured
      if (this.config.performance?.useSymlinks !== false) {
        const latestPath = path.join(contactPath, 'latest')
        
        // Remove old symlink if exists
        try {
          await fs.unlink(latestPath)
        } catch (e) {
          // Ignore if doesn't exist
        }
        
        // Create new symlink to latest version
        await fs.symlink(versionFile, latestPath)
      }
      
      // Cleanup old versions if configured
      if (this.config.versioning?.keepVersions) {
        await this.cleanupOldVersions(contactPath, version, this.config.versioning.keepVersions)
      }
      
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Load latest contact content
   */
  async loadContactContent<T = unknown>(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId
  ): Promise<Result<T | null, StorageError>> {
    try {
      const contactPath = this.getContactPath(networkId, groupId, contactId)
      
      let targetPath: string | null
      
      // Try to use 'latest' symlink if available
      if (this.config.performance?.useSymlinks !== false) {
        const latestPath = path.join(contactPath, 'latest')
        try {
          await fs.access(latestPath)
          targetPath = latestPath
        } catch {
          // Symlink doesn't exist, find latest version manually
          targetPath = await this.findLatestVersion(contactPath)
          if (!targetPath) return { ok: true, value: null }
        }
      } else {
        targetPath = await this.findLatestVersion(contactPath)
        if (!targetPath) return { ok: true, value: null }
      }
      
      // targetPath should never be null here due to early returns
      if (!targetPath) return { ok: true, value: null }
      
      // Read and deserialize
      const data = await fs.readFile(targetPath, 'utf8')
      const parsed = JSON.parse(data)
      const deserialized = deserialize.any(parsed.content) as T
      
      return { ok: true, value: deserialized }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return { ok: true, value: null }
      }
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Find the latest version file in a directory
   */
  private async findLatestVersion(contactPath: string): Promise<string | null> {
    try {
      const files = await fs.readdir(contactPath)
      const versionFiles = files
        .filter(f => f.match(/^v\d+\.json$/))
        .sort((a, b) => b.localeCompare(a))  // Sort descending
      
      if (versionFiles.length === 0) return null
      
      return path.join(contactPath, versionFiles[0])
    } catch {
      return null
    }
  }
  
  /**
   * Get version history for a contact
   */
  async getContactHistory(
    networkId: NetworkId, 
    groupId: GroupId, 
    contactId: ContactId,
    limit?: number
  ): Promise<Result<Array<{ version: number, timestamp: number, content: any }>, StorageError>> {
    try {
      const contactPath = this.getContactPath(networkId, groupId, contactId)
      
      const files = await fs.readdir(contactPath)
      const versionFiles = files
        .filter(f => f.match(/^v\d+\.json$/))
        .sort((a, b) => b.localeCompare(a))  // Sort descending
        .slice(0, limit)
      
      const history = await Promise.all(
        versionFiles.map(async (file) => {
          const filePath = path.join(contactPath, file)
          const data = await fs.readFile(filePath, 'utf8')
          const parsed = JSON.parse(data)
          return {
            version: parsed.version,
            timestamp: parsed.timestamp,
            content: deserialize.any(parsed.content)
          }
        })
      )
      
      return { ok: true, value: history }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Cleanup old versions, keeping only the specified number
   */
  private async cleanupOldVersions(contactPath: string, _currentVersion: number, keepVersions: number): Promise<void> {
    const files = await fs.readdir(contactPath)
    const versionFiles = files
      .filter(f => f.match(/^v\d+\.json$/))
      .map(f => ({
        file: f,
        version: parseInt(f.slice(1, -5), 10)
      }))
      .sort((a, b) => b.version - a.version)  // Sort by version descending
    
    // Keep the latest N versions
    const toDelete = versionFiles.slice(keepVersions)
    
    for (const { file } of toDelete) {
      const filePath = path.join(contactPath, file)
      
      if (this.config.versioning?.archiveOldVersions) {
        // Move to archive directory
        const archivePath = path.join(contactPath, 'archive')
        await fs.mkdir(archivePath, { recursive: true })
        await fs.rename(filePath, path.join(archivePath, file))
      } else {
        // Delete old version
        await fs.unlink(filePath)
      }
    }
  }
  
  /**
   * Stream-based batch append for high throughput
   */
  async batchAppend(
    operations: Array<{
      networkId: NetworkId
      groupId: GroupId
      contactId: ContactId
      content: any
    }>
  ): Promise<Result<void, StorageError>> {
    // Use parallelism limit to avoid file descriptor exhaustion
    const parallelism = this.config.performance?.parallelism || 10
    
    const chunks = []
    for (let i = 0; i < operations.length; i += parallelism) {
      chunks.push(operations.slice(i, i + parallelism))
    }
    
    try {
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(op => 
            this.saveContactContent(op.networkId, op.groupId, op.contactId, op.content)
          )
        )
      }
      
      return { ok: true, value: undefined }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_SERIALIZATION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  /**
   * Get storage statistics
   */
  async getStats(): Promise<Result<any, StorageError>> {
    try {
      const stats = {
        basePath: this.basePath,
        networks: 0,
        groups: 0,
        contacts: 0,
        totalVersions: 0,
        totalSize: 0
      }
      
      // Walk the directory structure
      const networksPath = path.join(this.basePath, 'networks')
      const networks = await fs.readdir(networksPath)
      stats.networks = networks.length
      
      for (const network of networks) {
        const groupsPath = path.join(networksPath, network, 'groups')
        try {
          const groups = await fs.readdir(groupsPath)
          stats.groups += groups.length
          
          for (const group of groups) {
            const contactsPath = path.join(groupsPath, group, 'contacts')
            try {
              const contacts = await fs.readdir(contactsPath)
              stats.contacts += contacts.length
              
              for (const contact of contacts) {
                const contactPath = path.join(contactsPath, contact)
                const files = await fs.readdir(contactPath)
                const versionFiles = files.filter(f => f.match(/^v\d+\.json$/))
                stats.totalVersions += versionFiles.length
                
                // Calculate total size
                for (const file of versionFiles) {
                  const filePath = path.join(contactPath, file)
                  const stat = await fs.stat(filePath)
                  stats.totalSize += stat.size
                }
              }
            } catch {
              // No contacts
            }
          }
        } catch {
          // No groups
        }
      }
      
      return { ok: true, value: stats }
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'STORAGE_CONNECTION_ERROR',
          message: error.message,
          details: error
        }
      }
    }
  }
  
  async close(): Promise<Result<void, StorageError>> {
    // Clear version counters
    this.versionCounters.clear()
    return { ok: true, value: undefined }
  }
}

export function createFilesystemStorage(config?: FilesystemStorageConfig) {
  return new FilesystemAppendOnlyStorage(config)
}