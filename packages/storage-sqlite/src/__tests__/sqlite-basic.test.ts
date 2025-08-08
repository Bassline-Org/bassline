/**
 * Basic SQLite Storage Tests
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SQLiteStorage } from '../index.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId } from '@bassline/core'
import { rmSync } from 'fs'

describe('SQLite Storage Basic Tests', () => {
  let storage: SQLiteStorage
  let networkId: NetworkId
  const testDir = './test-data-basic'
  
  beforeAll(async () => {
    // Clean up any existing test data
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (e) {}
    
    storage = new SQLiteStorage({
      options: {
        dataDir: testDir,
        mode: 'sharded',
        synchronous: 'OFF', // Fast for tests
      }
    })
    
    await storage.initialize()
    
    networkId = brand.networkId(`test-${Date.now()}`)
  })
  
  afterAll(async () => {
    await storage.close()
    // Clean up test data
    rmSync(testDir, { recursive: true, force: true })
  })
  
  describe('Contact Operations', () => {
    it('should save and load contact content', async () => {
      const groupId = brand.groupId('test-group')
      const contactId = brand.contactId('test-contact')
      const content = { message: 'Hello SQLite!', value: 42 }
      
      // Save
      const saveResult = await storage.saveContactContent(
        networkId,
        groupId,
        contactId,
        content
      )
      // saveResult succeeded
      
      // Load
      const loadResult = await storage.loadContactContent(
        networkId,
        groupId,
        contactId
      )
      // loadResult succeeded
      expect(loadResult).toEqual(content)
    })
    
    it('should handle missing contacts', async () => {
      const result = await storage.loadContactContent(
        networkId,
        brand.groupId('missing'),
        brand.contactId('missing')
      )
      // result succeeded
      expect(result).toBeNull()
    })
    
    it('should update existing contacts', async () => {
      const groupId = brand.groupId('update-group')
      const contactId = brand.contactId('update-contact')
      
      // Initial save
      await storage.saveContactContent(networkId, groupId, contactId, { v: 1 })
      
      // Update
      await storage.saveContactContent(networkId, groupId, contactId, { v: 2 })
      
      // Verify
      const result = await storage.loadContactContent(networkId, groupId, contactId)
      // result succeeded
      expect(result).toEqual({ v: 2 })
    })
  })
  
  describe('Group Operations', () => {
    it('should save and load group state', async () => {
      const groupId = brand.groupId('full-group')
      
      const contacts = new Map()
      for (let i = 0; i < 10; i++) {
        contacts.set(brand.contactId(`contact-${i}`), {
          id: brand.contactId(`contact-${i}`),
          content: { value: i },
          blendMode: 'accept-last'
        })
      }
      
      const wires = new Map()
      wires.set(brand.wireId('wire-1'), {
        id: brand.wireId('wire-1'),
        fromId: brand.contactId('contact-0'),
        toId: brand.contactId('contact-1'),
        type: 'bidirectional'
      })
      
      const groupState = {
        group: {
          id: groupId,
          name: 'Test Group',
          contactIds: Array.from(contacts.keys()),
          wireIds: Array.from(wires.keys()),
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires
      }
      
      // Save
      const saveResult = await storage.saveGroupState(networkId, groupId, groupState)
      // saveResult succeeded
      
      // Load
      const loadResult = await storage.loadGroupState(networkId, groupId)
      // loadResult succeeded
      expect(loadResult).not.toBeNull()
      expect(loadResult.contacts.size).toBe(10)
      expect(loadResult.wires.size).toBe(1)
      expect(loadResult.group.name).toBe('Test Group')
    })
    
    it('should replace group state on save', async () => {
      const groupId = brand.groupId('replace-group')
      
      // Initial state
      const initialState = {
        group: {
          id: groupId,
          name: 'Initial',
          contactIds: [brand.contactId('c1')],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map([
          [brand.contactId('c1'), {
            id: brand.contactId('c1'),
            content: { value: 1 },
            blendMode: 'accept-last'
          }]
        ]),
        wires: new Map()
      }
      
      await storage.saveGroupState(networkId, groupId, initialState)
      
      // New state (replaces old)
      const newState = {
        group: {
          id: groupId,
          name: 'Updated',
          contactIds: [brand.contactId('c2')],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map([
          [brand.contactId('c2'), {
            id: brand.contactId('c2'),
            content: { value: 2 },
            blendMode: 'accept-last'
          }]
        ]),
        wires: new Map()
      }
      
      await storage.saveGroupState(networkId, groupId, newState)
      
      // Verify replacement
      const result = await storage.loadGroupState(networkId, groupId)
      // result succeeded
      expect(result.group.name).toBe('Updated')
      expect(result.contacts.size).toBe(1)
      expect(result.contacts.has(brand.contactId('c1'))).toBe(false)
      expect(result.contacts.has(brand.contactId('c2'))).toBe(true)
    })
  })
  
  describe('Network Operations', () => {
    it('should save and load network state', async () => {
      const state = {
        networkId,
        groups: new Map(),
        wires: new Map(),
        currentGroupId: 'current',
        rootGroupId: 'root'
      }
      
      const saveResult = await storage.saveNetworkState(networkId, state)
      // saveResult succeeded
      
      const loadResult = await storage.loadNetworkState(networkId)
      // loadResult succeeded
      expect(loadResult.currentGroupId).toBe('current')
      expect(loadResult.rootGroupId).toBe('root')
    })
    
    it('should check network existence', async () => {
      const exists1 = await storage.exists(networkId)
      // exists1 succeeded
      expect(exists1).toBe(true)
      
      const exists2 = await storage.exists(brand.networkId('nonexistent'))
      // exists2 succeeded
      expect(exists2).toBe(false)
    })
    
    it('should list networks', async () => {
      const result = await storage.listNetworks()
      // result succeeded
      expect(result).toContain(networkId)
    })
  })
  
  describe('StorageDriver Interface', () => {
    it.skip('should work with the simplified driver interface', async () => {
      const groupId = 'driver-group'
      const contactId = 'driver-contact'
      const content = { test: 'driver' }
      
      // Save through driver interface
      await storage.save(networkId, groupId, contactId, content)
      
      // Load through driver interface
      const loaded = await storage.load(networkId, groupId, contactId)
      expect(loaded).toEqual(content)
      
      // Delete through driver interface
      await storage.delete(networkId, groupId, contactId)
      
      // Verify deletion
      const deleted = await storage.load(networkId, groupId, contactId)
      expect(deleted).toBeNull()
    })
    
    it.skip('should handle events', async () => {
      let savedData: any = null
      let deletedData: any = null
      
      const saveHandler = (data: any) => { savedData = data }
      const deleteHandler = (data: any) => { deletedData = data }
      
      storage.on('contact:saved', saveHandler)
      storage.on('contact:deleted', deleteHandler)
      
      // Trigger save event
      await storage.save(networkId, 'event-group', 'event-contact', { v: 1 })
      expect(savedData).toEqual({
        networkId,
        groupId: 'event-group',
        contactId: 'event-contact',
        content: { v: 1 }
      })
      
      // Trigger delete event
      await storage.delete(networkId, 'event-group', 'event-contact')
      expect(deletedData).toEqual({
        networkId,
        groupId: 'event-group',
        contactId: 'event-contact'
      })
      
      // Clean up handlers
      storage.off('contact:saved', saveHandler)
      storage.off('contact:deleted', deleteHandler)
    })
  })
})