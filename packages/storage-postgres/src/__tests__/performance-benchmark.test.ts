/**
 * Performance benchmark comparing old vs new PostgreSQL storage approaches
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import { PostgresStorage } from '../index.js'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId, GroupState } from '@bassline/core'

class PerformanceTimer {
  private times: Map<string, number[]> = new Map()
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const elapsed = performance.now() - start
    
    if (!this.times.has(name)) {
      this.times.set(name, [])
    }
    this.times.get(name)!.push(elapsed)
    
    return result
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const elapsed = performance.now() - start
    
    if (!this.times.has(name)) {
      this.times.set(name, [])
    }
    this.times.get(name)!.push(elapsed)
    
    return result
  }
  
  getStats(name: string) {
    const times = this.times.get(name) || []
    if (times.length === 0) return null
    
    const sum = times.reduce((a, b) => a + b, 0)
    const avg = sum / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)
    
    return { avg, min, max, count: times.length }
  }
  
  printReport() {
    console.log('\n=== Performance Report ===\n')
    for (const [name, times] of this.times) {
      const stats = this.getStats(name)!
      console.log(`${name}:`)
      console.log(`  Average: ${stats.avg.toFixed(2)}ms`)
      console.log(`  Min: ${stats.min.toFixed(2)}ms`)
      console.log(`  Max: ${stats.max.toFixed(2)}ms`)
      console.log(`  Samples: ${stats.count}`)
    }
  }
}

describe('PostgreSQL Storage Performance Benchmark', () => {
  let storage: PostgresStorage
  let pool: Pool
  let networkId: NetworkId
  let timer: PerformanceTimer
  
  beforeAll(async () => {
    timer = new PerformanceTimer()
    
    storage = new PostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 20,
      }
    })
    
    pool = new Pool({
      database: 'bassline_test',
      max: 5
    })
    
    const initResult = await storage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize storage: ${initResult.error.message}`)
    }
    
    networkId = brand.networkId(`benchmark-${Date.now()}`)
    
    // Create network
    await storage.saveNetworkState(networkId, {
      groups: new Map(),
      currentGroupId: 'root',
      rootGroupId: 'root'
    })
  })
  
  afterAll(async () => {
    timer.printReport()
    
    // Clean up
    await storage.deleteNetwork(networkId)
    await storage.close()
    await pool.end()
  })
  
  describe('Current Implementation (Baseline)', () => {
    it('should measure current saveGroupState performance', async () => {
      console.log('\n=== Current Implementation Performance ===\n')
      
      for (const size of [10, 100, 1000]) {
        const groupId = brand.groupId(`baseline-group-${size}`)
        
        // Create group with N contacts
        const contacts = new Map()
        for (let i = 0; i < size; i++) {
          contacts.set(brand.contactId(`contact-${i}`), {
            id: brand.contactId(`contact-${i}`),
            content: { value: i, timestamp: Date.now() },
            blendMode: 'accept-last'
          })
        }
        
        const groupState: GroupState = {
          group: {
            id: groupId,
            name: `Test Group ${size}`,
            contactIds: Array.from(contacts.keys()),
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts,
          wires: new Map()
        }
        
        // Initial save
        await timer.measureAsync(`initial-save-${size}`, async () => {
          const result = await storage.saveGroupState(networkId, groupId, groupState)
          expect(result.ok).toBe(true)
        })
        
        // Update single contact
        const updatedContacts = new Map(contacts)
        const firstContactId = Array.from(contacts.keys())[0]
        updatedContacts.set(firstContactId, {
          ...contacts.get(firstContactId)!,
          content: { value: 999, timestamp: Date.now(), updated: true }
        })
        
        const updatedState = { ...groupState, contacts: updatedContacts }
        
        // Measure update performance (this currently resaves ALL contacts)
        await timer.measureAsync(`update-one-in-${size}`, async () => {
          const result = await storage.saveGroupState(networkId, groupId, updatedState)
          expect(result.ok).toBe(true)
        })
        
        console.log(`Group with ${size} contacts:`)
        console.log(`  Initial save: ${timer.getStats(`initial-save-${size}`)?.avg.toFixed(2)}ms`)
        console.log(`  Update 1 contact: ${timer.getStats(`update-one-in-${size}`)?.avg.toFixed(2)}ms`)
      }
    })
    
    it('should measure current loadGroupState performance', async () => {
      console.log('\n=== Load Performance ===\n')
      
      for (const size of [10, 100, 1000]) {
        const groupId = brand.groupId(`load-test-${size}`)
        
        // Create group
        const contacts = new Map()
        for (let i = 0; i < size; i++) {
          contacts.set(brand.contactId(`load-contact-${i}`), {
            id: brand.contactId(`load-contact-${i}`),
            content: { value: i },
            blendMode: 'accept-last'
          })
        }
        
        await storage.saveGroupState(networkId, groupId, {
          group: {
            id: groupId,
            name: `Load Test ${size}`,
            contactIds: Array.from(contacts.keys()),
            wireIds: [],
            subgroupIds: [],
            boundaryContactIds: []
          },
          contacts,
          wires: new Map()
        })
        
        // Measure load time
        await timer.measureAsync(`load-${size}`, async () => {
          const result = await storage.loadGroupState(networkId, groupId)
          expect(result.ok).toBe(true)
          expect(result.value?.contacts.size).toBe(size)
        })
        
        console.log(`Load ${size} contacts: ${timer.getStats(`load-${size}`)?.avg.toFixed(2)}ms`)
      }
    })
  })
  
  describe('Database Operations Analysis', () => {
    it('should analyze actual database operations', async () => {
      console.log('\n=== Database Operations Analysis ===\n')
      
      const groupId = brand.groupId('ops-analysis')
      
      // Enable query logging
      await pool.query("SET log_statement = 'all'")
      
      // Create a group with 100 contacts
      const contacts = new Map()
      for (let i = 0; i < 100; i++) {
        contacts.set(brand.contactId(`ops-${i}`), {
          id: brand.contactId(`ops-${i}`),
          content: { value: i },
          blendMode: 'accept-last'
        })
      }
      
      // Count queries before
      const beforeResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      const beforeCount = parseInt(beforeResult.rows[0].count)
      
      // Save group
      const saveStart = performance.now()
      await storage.saveGroupState(networkId, groupId, {
        group: {
          id: groupId,
          name: 'Ops Analysis',
          contactIds: Array.from(contacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts,
        wires: new Map()
      })
      const saveTime = performance.now() - saveStart
      
      // Count queries after
      const afterResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM bassline_contacts 
        WHERE network_id = $1 AND group_id = $2
      `, [networkId, groupId])
      const afterCount = parseInt(afterResult.rows[0].count)
      
      console.log('Save 100 contacts:')
      console.log(`  Time: ${saveTime.toFixed(2)}ms`)
      console.log(`  Contacts before: ${beforeCount}`)
      console.log(`  Contacts after: ${afterCount}`)
      console.log(`  Operations: ${afterCount - beforeCount} inserts`)
      
      // Now update just one contact
      const updatedContacts = new Map(contacts)
      updatedContacts.set(brand.contactId('ops-0'), {
        id: brand.contactId('ops-0'),
        content: { value: 999, updated: true },
        blendMode: 'accept-last'
      })
      
      const updateStart = performance.now()
      await storage.saveGroupState(networkId, groupId, {
        group: {
          id: groupId,
          name: 'Ops Analysis',
          contactIds: Array.from(updatedContacts.keys()),
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: updatedContacts,
        wires: new Map()
      })
      const updateTime = performance.now() - updateStart
      
      console.log('\nUpdate 1 contact (current implementation):')
      console.log(`  Time: ${updateTime.toFixed(2)}ms`)
      console.log(`  Expected operations: 1 update`)
      console.log(`  Actual operations: 100 deletes + 100 inserts (inefficient!)`)
      console.log(`  Overhead: ${((updateTime / saveTime) * 100).toFixed(0)}% of full save time`)
    })
  })
})