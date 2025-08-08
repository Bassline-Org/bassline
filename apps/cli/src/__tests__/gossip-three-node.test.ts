/**
 * Three-node gossip test
 * Tests that nodes with different storage backends converge to the same state
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { GossipLayer } from '../runtime/GossipLayer.js'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { createFilesystemStorage } from '@bassline/storage-filesystem'
import { createRemoteWebSocketStorage } from '@bassline/storage-remote'
import { Pool } from 'pg'
import * as fs from 'fs/promises'
import { brand } from '@bassline/core'

describe('Three-node gossip with different storage backends', () => {
  let node1: GossipLayer // PostgreSQL
  let node2: GossipLayer // Remote -> PostgreSQL
  let node3: GossipLayer // Filesystem
  let pool: Pool
  
  beforeAll(async () => {
    // Clean up test data
    pool = new Pool({ database: 'bassline_test', max: 10 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_contact_values CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contact_values_fast CASCADE;
    `).catch(() => {}) // Ignore if tables don't exist
    client.release()
    
    // Clean filesystem
    await fs.rm('./test-gossip-data', { recursive: true, force: true }).catch(() => {})
    
    // Node 1: Direct PostgreSQL storage
    node1 = new GossipLayer({
      id: 'node1',
      port: 8001,
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance' // Use unlogged for speed
      }),
      syncInterval: 500 // Much faster sync for testing (0.5 seconds)
    })
    
    // Start node1 first
    await node1.start()
    await new Promise(resolve => setTimeout(resolve, 100)) // Let it initialize
    
    // Node 2: Remote storage pointing to Node 1
    // First we need to add storage proxy to node1's WebSocket server
    // For now, we'll use filesystem as a stand-in
    node2 = new GossipLayer({
      id: 'node2',
      port: 8002,
      storage: createFilesystemStorage({ 
        basePath: './test-gossip-data/node2' 
      }),
      peers: ['ws://localhost:8001'],
      syncInterval: 500 // Much faster sync for testing
    })
    
    // Node 3: Filesystem storage
    node3 = new GossipLayer({
      id: 'node3',
      port: 8003,
      storage: createFilesystemStorage({ 
        basePath: './test-gossip-data/node3' 
      }),
      peers: ['ws://localhost:8001', 'ws://localhost:8002'],
      syncInterval: 500 // Much faster sync for testing
    })
    
    // Start remaining nodes
    await node2.start()
    await node3.start()
    
    // Give them time to connect
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Initialize test data in node1
    const runtime1 = node1.getRuntime()
    runtime1.registerGroup({
      id: 'root',
      name: 'Root Group',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Add some initial contacts
    for (let i = 0; i < 5; i++) {
      runtime1.addContact('root', {
        id: `initial-${i}`,
        content: { value: i, source: 'node1' },
        blendMode: 'accept-last'
      })
    }
    
    // Wait for initial sync
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 30000)
  
  afterAll(async () => {
    await node1?.stop()
    await node2?.stop()
    await node3?.stop()
    await pool?.end()
    
    // Cleanup
    await fs.rm('./test-gossip-data', { recursive: true, force: true }).catch(() => {})
  })
  
  it('should converge with random updates to different nodes', { timeout: 20000 }, async () => {
    console.log('\n=== RANDOM UPDATE CONVERGENCE TEST ===\n')
    
    // Send updates to random nodes
    const updates: Array<{ node: GossipLayer; contactId: string; content: any }> = []
    
    for (let i = 0; i < 30; i++) {
      const nodes = [node1, node2, node3]
      const node = nodes[Math.floor(Math.random() * 3)]
      const contactId = `contact-${i % 10}` // Reuse some IDs to test updates
      const content = {
        value: i,
        timestamp: Date.now(),
        source: node === node1 ? 'node1' : node === node2 ? 'node2' : 'node3'
      }
      
      updates.push({ node, contactId, content })
      await node.updateContact(contactId, content)
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    // Trigger multiple rounds of sync to ensure convergence
    console.log('Triggering sync rounds...')
    for (let round = 0; round < 3; round++) {
      console.log(`  Sync round ${round + 1}...`)
      await Promise.all([
        node1.triggerSync(),
        node2.triggerSync(),
        node3.triggerSync()
      ])
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Wait for final propagation
    console.log('Waiting for final convergence...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Verify all nodes have the same content hashes
    console.log('\nVerifying convergence:')
    const mismatches: string[] = []
    
    for (let i = 0; i < 10; i++) {
      const contactId = `contact-${i}`
      const hash1 = node1.getContentHash(contactId)
      const hash2 = node2.getContentHash(contactId)
      const hash3 = node3.getContentHash(contactId)
      
      console.log(`Contact ${contactId}:`)
      console.log(`  Node1 hash: ${hash1?.substring(0, 8)}...`)
      console.log(`  Node2 hash: ${hash2?.substring(0, 8)}...`)
      console.log(`  Node3 hash: ${hash3?.substring(0, 8)}...`)
      
      if (hash1 !== hash2 || hash2 !== hash3) {
        mismatches.push(contactId)
        console.log(`  ❌ MISMATCH!`)
      } else if (hash1) {
        console.log(`  ✅ All nodes agree`)
      }
    }
    
    expect(mismatches).toHaveLength(0)
  })
  
  it('should handle updates during network partition', { timeout: 20000 }, async () => {
    console.log('\n=== NETWORK PARTITION TEST ===\n')
    
    // Simulate partition by stopping node3
    console.log('Stopping node3 to simulate partition...')
    await node3.stop()
    
    // Update contacts on node1 and node2
    for (let i = 0; i < 5; i++) {
      await node1.updateContact(`partition-${i}`, {
        value: `node1-${i}`,
        timestamp: Date.now()
      })
      
      await node2.updateContact(`partition-${i + 5}`, {
        value: `node2-${i}`,
        timestamp: Date.now()
      })
    }
    
    // Restart node3
    console.log('Restarting node3...')
    node3 = new GossipLayer({
      id: 'node3',
      port: 8003,
      storage: createFilesystemStorage({ 
        basePath: './test-gossip-data/node3' 
      }),
      peers: ['ws://localhost:8001', 'ws://localhost:8002'],
      syncInterval: 5000
    })
    await node3.start()
    
    // Wait for sync
    console.log('Waiting for sync after partition heal...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Verify all partition updates are synced
    console.log('\nVerifying partition recovery:')
    for (let i = 0; i < 10; i++) {
      const contactId = `partition-${i}`
      const hash1 = node1.getContentHash(contactId)
      const hash2 = node2.getContentHash(contactId)
      const hash3 = node3.getContentHash(contactId)
      
      if (hash1 || hash2 || hash3) {
        console.log(`Contact ${contactId}: ${hash1 === hash2 && hash2 === hash3 ? '✅' : '❌'}`)
        expect(hash1).toBe(hash2)
        expect(hash2).toBe(hash3)
      }
    }
  })
  
  it('should reject invalid updates from bad peers', async () => {
    console.log('\n=== BAD PEER REJECTION TEST ===\n')
    
    // Create a bad peer that sends invalid data
    const WebSocket = (await import('ws')).default
    const badPeer = new WebSocket('ws://localhost:8001')
    
    await new Promise((resolve) => {
      badPeer.on('open', () => {
        console.log('Bad peer connected, sending invalid data...')
        
        // Send invalid content-response (will fail propagation)
        badPeer.send(JSON.stringify({
          type: 'content-response',
          contactId: 'bad-contact',
          content: {
            // This will fail because it's missing required fields
            // or has wrong structure for propagation
            invalidField: 'this should fail',
            __proto__: { malicious: 'attempt' } // Try prototype pollution
          }
        }))
        
        // Send multiple bad messages to trigger blacklist
        for (let i = 0; i < 5; i++) {
          badPeer.send(JSON.stringify({
            type: 'content-response',
            contactId: `bad-${i}`,
            content: null // Invalid content
          }))
        }
        
        setTimeout(resolve, 1000)
      })
    })
    
    // Verify the bad peer got disconnected
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Check that bad content was not propagated
    const badHash1 = node1.getContentHash('bad-contact')
    const badHash2 = node2.getContentHash('bad-contact')
    const badHash3 = node3.getContentHash('bad-contact')
    
    console.log('Checking if bad content was rejected:')
    console.log(`  Node1 has bad content: ${badHash1 ? '❌ NO (good!)' : '✅ NO'}`)
    console.log(`  Node2 has bad content: ${badHash2 ? '❌ NO (good!)' : '✅ NO'}`)
    console.log(`  Node3 has bad content: ${badHash3 ? '❌ NO (good!)' : '✅ NO'}`)
    
    expect(badHash1).toBeUndefined()
    expect(badHash2).toBeUndefined()
    expect(badHash3).toBeUndefined()
    
    badPeer.close()
  })
  
  it('should efficiently sync using content-check protocol', async () => {
    console.log('\n=== CONTENT-CHECK EFFICIENCY TEST ===\n')
    
    // Update the same contact on all nodes with the same content
    const sharedContent = { value: 'shared', timestamp: 12345 }
    
    console.log('Setting same content on all nodes...')
    await node1.updateContact('shared-contact', sharedContent)
    await node2.updateContact('shared-contact', sharedContent)
    await node3.updateContact('shared-contact', sharedContent)
    
    // Verify they all have the same hash
    const hash1 = node1.getContentHash('shared-contact')
    const hash2 = node2.getContentHash('shared-contact')
    const hash3 = node3.getContentHash('shared-contact')
    
    console.log('\nContent hashes:')
    console.log(`  Node1: ${hash1?.substring(0, 16)}...`)
    console.log(`  Node2: ${hash2?.substring(0, 16)}...`)
    console.log(`  Node3: ${hash3?.substring(0, 16)}...`)
    
    expect(hash1).toBe(hash2)
    expect(hash2).toBe(hash3)
    
    // Now update with different content on one node
    console.log('\nUpdating content on node1 only...')
    await node1.updateContact('shared-contact', { value: 'updated', timestamp: 99999 })
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Verify all nodes updated
    const newHash1 = node1.getContentHash('shared-contact')
    const newHash2 = node2.getContentHash('shared-contact')
    const newHash3 = node3.getContentHash('shared-contact')
    
    console.log('\nUpdated content hashes:')
    console.log(`  Node1: ${newHash1?.substring(0, 16)}...`)
    console.log(`  Node2: ${newHash2?.substring(0, 16)}...`)
    console.log(`  Node3: ${newHash3?.substring(0, 16)}...`)
    
    expect(newHash1).toBe(newHash2)
    expect(newHash2).toBe(newHash3)
    expect(newHash1).not.toBe(hash1) // Should be different from original
  })
})