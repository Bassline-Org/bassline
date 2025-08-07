import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createFilesystemStorage } from '../index'

describe('Filesystem Append-Only Storage', () => {
  const testBasePath = './test-bassline-data'
  let storage: ReturnType<typeof createFilesystemStorage>
  let networkId: NetworkId
  let groupId: GroupId
  
  beforeAll(async () => {
    networkId = brand.networkId('test-network')
    groupId = brand.groupId('test-group')
  })
  
  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testBasePath, { recursive: true, force: true })
    } catch {}
    
    // Create fresh storage instance
    storage = createFilesystemStorage({ 
      basePath: testBasePath,
      performance: { useSymlinks: true }
    })
    await storage.initialize()
  })
  
  afterAll(async () => {
    // Final cleanup
    try {
      await fs.rm(testBasePath, { recursive: true, force: true })
    } catch {}
  })
  
  describe('Basic Operations', () => {
    it('should save and load contact content', async () => {
      const contactId = brand.contactId('test-contact')
      const content = { value: 42, message: 'Hello World' }
      
      // Save
      const saveResult = await storage.saveContactContent(
        networkId, groupId, contactId, content
      )
      expect(saveResult.ok).toBe(true)
      
      // Load
      const loadResult = await storage.loadContactContent(
        networkId, groupId, contactId
      )
      expect(loadResult.ok).toBe(true)
      expect(loadResult.ok).toBe(true)
      if (loadResult.ok) {
        expect(loadResult.value).toEqual(content)
      }
    })
    
    it('should create version files for each update', async () => {
      const contactId = brand.contactId('versioned-contact')
      
      // Save multiple versions
      for (let i = 1; i <= 5; i++) {
        await storage.saveContactContent(
          networkId, groupId, contactId, 
          { version: i, data: `Version ${i}` }
        )
      }
      
      // Check version files exist
      const contactPath = path.join(
        testBasePath, 'networks', networkId, 'groups', groupId, 'contacts', contactId
      )
      const files = await fs.readdir(contactPath)
      const versionFiles = files.filter(f => f.match(/^v\d+\.json$/))
      
      expect(versionFiles).toHaveLength(5)
      expect(versionFiles).toContain('v00000001.json')
      expect(versionFiles).toContain('v00000005.json')
      
      // Verify latest returns most recent
      const result = await storage.loadContactContent(networkId, groupId, contactId)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({ version: 5, data: 'Version 5' })
      }
    })
    
    it('should handle concurrent writes without conflicts', async () => {
      const promises = []
      
      // Create 100 concurrent writes to different contacts
      for (let i = 0; i < 100; i++) {
        const contactId = brand.contactId(`concurrent-${i}`)
        promises.push(
          storage.saveContactContent(
            networkId, groupId, contactId,
            { id: i, timestamp: Date.now() }
          )
        )
      }
      
      const results = await Promise.all(promises)
      expect(results.every(r => r.ok)).toBe(true)
      
      // Verify all were saved
      for (let i = 0; i < 100; i++) {
        const contactId = brand.contactId(`concurrent-${i}`)
        const result = await storage.loadContactContent(
          networkId, groupId, contactId
        )
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toHaveProperty('id', i)
        }
      }
    })
    
    it('should use symlinks for latest when configured', async () => {
      const contactId = brand.contactId('symlink-test')
      
      await storage.saveContactContent(
        networkId, groupId, contactId,
        { test: 'data' }
      )
      
      const contactPath = path.join(
        testBasePath, 'networks', networkId, 'groups', groupId, 'contacts', contactId
      )
      const latestPath = path.join(contactPath, 'latest')
      
      // Check symlink exists
      const stat = await fs.lstat(latestPath)
      expect(stat.isSymbolicLink()).toBe(true)
      
      // Verify symlink points to version file
      const target = await fs.readlink(latestPath)
      expect(target).toMatch(/^v\d+\.json$/)
    })
  })
  
  describe('Version History', () => {
    it('should track version history correctly', async () => {
      const contactId = brand.contactId('history-test')
      
      // Create 10 versions
      for (let i = 1; i <= 10; i++) {
        await storage.saveContactContent(
          networkId, groupId, contactId,
          { version: i, timestamp: Date.now() + i }
        )
      }
      
      // Get history
      const history = await storage.getContactHistory(
        networkId, groupId, contactId, 5
      )
      
      expect(history.ok).toBe(true)
      if (history.ok) {
        expect(history.value).toHaveLength(5)
        
        // Should be in descending order (newest first)
        expect(history.value[0].version).toBe(10)
        expect(history.value[4].version).toBe(6)
      }
    })
    
    it('should cleanup old versions when configured', async () => {
      const cleanupStorage = createFilesystemStorage({
        basePath: testBasePath,
        versioning: { keepVersions: 3 }
      })
      await cleanupStorage.initialize()
      
      const contactId = brand.contactId('cleanup-test')
      
      // Create 10 versions
      for (let i = 1; i <= 10; i++) {
        await cleanupStorage.saveContactContent(
          networkId, groupId, contactId,
          { version: i }
        )
      }
      
      // Check only 3 versions remain
      const contactPath = path.join(
        testBasePath, 'networks', networkId, 'groups', groupId, 'contacts', contactId
      )
      const files = await fs.readdir(contactPath)
      const versionFiles = files.filter(f => f.match(/^v\d+\.json$/))
      
      expect(versionFiles).toHaveLength(3)
      expect(versionFiles).toContain('v00000010.json') // Latest
      expect(versionFiles).toContain('v00000009.json')
      expect(versionFiles).toContain('v00000008.json')
    })
  })
  
  describe('Batch Operations', () => {
    it('should handle batch appends efficiently', async () => {
      const operations = []
      const batchSize = 1000
      
      for (let i = 0; i < batchSize; i++) {
        operations.push({
          networkId,
          groupId,
          contactId: brand.contactId(`batch-${i}`),
          content: { id: i, data: `Item ${i}` }
        })
      }
      
      const start = performance.now()
      const result = await storage.batchAppend(operations)
      const duration = performance.now() - start
      
      expect(result.ok).toBe(true)
      
      console.log(`\nBatch append ${batchSize} items:`)
      console.log(`  Time: ${duration.toFixed(2)}ms`)
      console.log(`  Per operation: ${(duration/batchSize).toFixed(3)}ms`)
      console.log(`  Ops/second: ${Math.round(batchSize/(duration/1000)).toLocaleString()}`)
      
      // Verify some items
      for (let i = 0; i < 10; i++) {
        const contactId = brand.contactId(`batch-${i}`)
        const loadResult = await storage.loadContactContent(
          networkId, groupId, contactId
        )
        expect(loadResult.ok).toBe(true)
        if (loadResult.ok) {
          expect(loadResult.value).toEqual({ id: i, data: `Item ${i}` })
        }
      }
    })
  })
  
  describe('Storage Statistics', () => {
    it('should provide accurate storage statistics', async () => {
      // Create some test data
      for (let n = 0; n < 2; n++) {
        const netId = brand.networkId(`net-${n}`)
        for (let g = 0; g < 3; g++) {
          const grpId = brand.groupId(`grp-${g}`)
          for (let c = 0; c < 5; c++) {
            const cntId = brand.contactId(`cnt-${c}`)
            await storage.saveContactContent(
              netId, grpId, cntId,
              { network: n, group: g, contact: c }
            )
          }
        }
      }
      
      const stats = await storage.getStats()
      expect(stats.ok).toBe(true)
      if (stats.ok) {
        expect(stats.value).toMatchObject({
        networks: 2,
        groups: 6,  // 2 networks * 3 groups
        contacts: 30, // 2 * 3 * 5
        totalVersions: 30,
        totalSize: expect.any(Number)
      })\n      }
    })
  })
})