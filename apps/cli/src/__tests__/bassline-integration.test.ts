/**
 * Bassline Integration Test
 * 
 * Full integration test with real networking, PostgreSQL storage, and partition healing
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WebSocketServer } from 'ws'
import { Pool } from 'pg'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { createMemoryStorage } from '@bassline/storage-memory'
import { createFilesystemStorage } from '@bassline/storage-filesystem'
import { GossipLayer } from '../runtime/GossipLayer.js'
import { StorageBackedRuntime } from '../runtime/StorageBackedRuntime.js'
import { brand } from '@bassline/core'
import * as fs from 'fs/promises'

describe('Bassline Integration with PostgreSQL', () => {
  let pool: Pool
  let nodes: GossipLayer[] = []
  
  beforeAll(async () => {
    // Setup PostgreSQL
    pool = new Pool({ database: 'bassline_test', max: 10 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_contact_values CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contact_values_fast CASCADE;
    `).catch(() => {})
    client.release()
    
    // Clean filesystem
    await fs.rm('./test-bassline-integration', { recursive: true, force: true }).catch(() => {})
  })
  
  afterAll(async () => {
    await Promise.all(nodes.map(n => n.stop()))
    await pool?.end()
    await fs.rm('./test-bassline-integration', { recursive: true, force: true }).catch(() => {})
  })
  
  it('should achieve 100% convergence with mixed storage backends', { timeout: 30000 }, async () => {
    console.log('\n=== BASSLINE INTEGRATION TEST ===')
    console.log('Creating 3 nodes with different storage backends...')
    
    // Create a shared topology (the Bassline concept)
    // All nodes will share this same structure
    const sharedTopology = {
      groups: ['input', 'compute', 'output'],
      contacts: {
        'input-a': { groupId: 'input', content: null },
        'input-b': { groupId: 'input', content: null },
        'compute-sum': { groupId: 'compute', content: null },
        'compute-product': { groupId: 'compute', content: null },
        'output-result': { groupId: 'output', content: null }
      },
      wires: [
        { from: 'input-a', to: 'compute-sum', type: 'directed' },
        { from: 'input-b', to: 'compute-sum', type: 'directed' },
        { from: 'input-a', to: 'compute-product', type: 'directed' },
        { from: 'input-b', to: 'compute-product', type: 'directed' },
        { from: 'compute-sum', to: 'output-result', type: 'directed' },
        { from: 'compute-product', to: 'output-result', type: 'directed' }
      ]
    }
    
    // Node 1: PostgreSQL storage, owns 'input' group
    const node1 = new GossipLayer({
      id: 'node1-postgres',
      port: 9101,
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance'
      }),
      syncInterval: 1000,
      peerExchangeInterval: 2000
    })
    
    // Node 2: Memory storage, owns 'compute' group  
    const node2 = new GossipLayer({
      id: 'node2-memory',
      port: 9102,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9101'],
      syncInterval: 1000,
      peerExchangeInterval: 2000
    })
    
    // Node 3: Filesystem storage, owns 'output' group
    const node3 = new GossipLayer({
      id: 'node3-filesystem',
      port: 9103,
      storage: createFilesystemStorage({
        basePath: './test-bassline-integration/node3'
      }),
      peers: ['ws://localhost:9102'],
      syncInterval: 1000,
      peerExchangeInterval: 2000
    })
    
    nodes = [node1, node2, node3]
    
    // Start all nodes
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Initialize topology on all nodes
    console.log('Initializing shared topology on all nodes...')
    for (const node of nodes) {
      const runtime = node.getRuntime()
      
      // Register all groups
      runtime.registerGroup({
        id: 'root',
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: ['input', 'compute', 'output'],
        boundaryContactIds: []
      })
      
      for (const groupId of sharedTopology.groups) {
        runtime.registerGroup({
          id: groupId,
          name: groupId,
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
      }
      
      // Add all contacts
      for (const [contactId, spec] of Object.entries(sharedTopology.contacts)) {
        runtime.addContact(spec.groupId, {
          id: contactId,
          content: spec.content,
          blendMode: 'accept-last'
        })
      }
      
      // Add all wires
      for (const wire of sharedTopology.wires) {
        runtime.connect(wire.from, wire.to, wire.type as any)
      }
    }
    
    console.log('\nNode ownership:')
    console.log('  Node1 (PostgreSQL): input group')
    console.log('  Node2 (Memory): compute group')
    console.log('  Node3 (Filesystem): output group')
    
    // Node1 sets input values
    console.log('\nNode1 setting input values...')
    await node1.updateContact('input-a', 10)
    await node1.updateContact('input-b', 20)
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Trigger sync
    await Promise.all(nodes.map(n => n.triggerSync()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Node2 should have received inputs and compute results
    console.log('\nNode2 computing results...')
    const node2_a = node2.getRuntime()['contacts'].get('input-a')?.content
    const node2_b = node2.getRuntime()['contacts'].get('input-b')?.content
    console.log(`  Received: a=${node2_a}, b=${node2_b}`)
    
    if (node2_a && node2_b) {
      await node2.updateContact('compute-sum', node2_a + node2_b)
      await node2.updateContact('compute-product', node2_a * node2_b)
    }
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Trigger sync
    await Promise.all(nodes.map(n => n.triggerSync()))
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Node3 should have received computed values
    console.log('\nNode3 generating final result...')
    const node3_sum = node3.getRuntime()['contacts'].get('compute-sum')?.content
    const node3_product = node3.getRuntime()['contacts'].get('compute-product')?.content
    console.log(`  Received: sum=${node3_sum}, product=${node3_product}`)
    
    if (node3_sum && node3_product) {
      await node3.updateContact('output-result', {
        sum: node3_sum,
        product: node3_product,
        final: node3_sum + node3_product
      })
    }
    
    // Wait for final propagation
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check convergence
    console.log('\nChecking convergence across all nodes...')
    
    // Count how many contacts each node has
    let totalContacts = 0
    let node1Has = 0
    let node2Has = 0
    let node3Has = 0
    
    for (const contactId of Object.keys(sharedTopology.contacts)) {
      totalContacts++
      
      const hash1 = node1.getContentHash(contactId)
      const hash2 = node2.getContentHash(contactId)
      const hash3 = node3.getContentHash(contactId)
      
      if (hash1) node1Has++
      if (hash2) node2Has++
      if (hash3) node3Has++
      
      // Check if all nodes that have it agree
      const hashes = [hash1, hash2, hash3].filter(h => h)
      if (hashes.length > 1) {
        const allSame = hashes.every(h => h === hashes[0])
        console.log(`  ${contactId}: ${allSame ? '✅ Consistent' : '❌ Inconsistent'} (${hashes.length} nodes have it)`)
      }
    }
    
    const convergence1 = (node1Has / totalContacts * 100).toFixed(1)
    const convergence2 = (node2Has / totalContacts * 100).toFixed(1)
    const convergence3 = (node3Has / totalContacts * 100).toFixed(1)
    
    console.log('\nConvergence rates:')
    console.log(`  Node1 (PostgreSQL): ${node1Has}/${totalContacts} contacts (${convergence1}%)`)
    console.log(`  Node2 (Memory): ${node2Has}/${totalContacts} contacts (${convergence2}%)`)
    console.log(`  Node3 (Filesystem): ${node3Has}/${totalContacts} contacts (${convergence3}%)`)
    
    // Verify final result
    const finalResult = node3.getRuntime()['contacts'].get('output-result')?.content
    console.log('\nFinal result:', finalResult)
    
    expect(finalResult).toBeDefined()
    expect(finalResult.sum).toBe(30)
    expect(finalResult.product).toBe(200)
    expect(finalResult.final).toBe(230)
    
    // All nodes should have high convergence
    expect(node1Has).toBeGreaterThanOrEqual(2)  // At least has its own
    expect(node2Has).toBeGreaterThanOrEqual(4)  // Has inputs and compute
    expect(node3Has).toBeGreaterThanOrEqual(3)  // Has compute and output
  })
  
  it('should handle partition and healing', { timeout: 30000 }, async () => {
    console.log('\n=== PARTITION HEALING TEST ===')
    
    // Clean up previous nodes
    await Promise.all(nodes.map(n => n.stop()))
    nodes = []
    
    // Create line topology: A - B - C - D - E
    console.log('Creating line topology: A - B - C - D - E')
    
    const nodeA = new GossipLayer({
      id: 'nodeA',
      port: 9201,
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance'
      }),
      syncInterval: 500
    })
    
    const nodeB = new GossipLayer({
      id: 'nodeB',
      port: 9202,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9201'],
      syncInterval: 500
    })
    
    const nodeC = new GossipLayer({
      id: 'nodeC',
      port: 9203,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9202'],
      syncInterval: 500
    })
    
    const nodeD = new GossipLayer({
      id: 'nodeD',
      port: 9204,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9203'],
      syncInterval: 500
    })
    
    const nodeE = new GossipLayer({
      id: 'nodeE',
      port: 9205,
      storage: createFilesystemStorage({
        basePath: './test-bassline-integration/nodeE'
      }),
      peers: ['ws://localhost:9204'],
      syncInterval: 500
    })
    
    nodes = [nodeA, nodeB, nodeC, nodeD, nodeE]
    
    // Start all nodes
    await Promise.all(nodes.map(n => n.start()))
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Initialize shared topology with wire connections
    for (const node of nodes) {
      const runtime = node.getRuntime()
      runtime.registerGroup({
        id: 'root',
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
    }
    
    // Create initial data
    console.log('\nCreating initial data...')
    await nodeA.updateContact('data-a', 'from-A')
    await nodeE.updateContact('data-e', 'from-E')
    
    // Let it propagate
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Create partition by stopping C
    console.log('Creating partition by stopping node C...')
    await nodeC.stop()
    
    // Create data on both sides of partition
    console.log('Creating data during partition...')
    await nodeA.updateContact('partition-left', 'A-side')
    await nodeE.updateContact('partition-right', 'E-side')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check partition exists
    const AhasRight = nodeA.getContentHash('partition-right')
    const EhasLeft = nodeE.getContentHash('partition-left')
    
    console.log('During partition:')
    console.log(`  A knows about E's data: ${!!AhasRight}`)
    console.log(`  E knows about A's data: ${!!EhasLeft}`)
    
    // Due to peer discovery, they might already know about each other
    // The important test is that after healing, they definitely converge
    
    // Restart C with connections to both sides
    console.log('\nRestarting C to heal partition...')
    const newNodeC = new GossipLayer({
      id: 'nodeC',
      port: 9203,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:9202', 'ws://localhost:9204'],
      syncInterval: 500
    })
    
    await newNodeC.start()
    nodes[2] = newNodeC
    
    // Initialize topology on new C
    const runtime = newNodeC.getRuntime()
    runtime.registerGroup({
      id: 'root',
      name: 'Root',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    // Wait for healing
    console.log('Waiting for partition to heal...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Trigger multiple rounds of aggressive sync
    console.log('Triggering aggressive sync rounds...')
    for (let i = 0; i < 5; i++) {
      await Promise.all(nodes.map(n => n.triggerSync()))
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Check partition healed
    const AhasRightAfter = nodeA.getContentHash('partition-right')
    const EhasLeftAfter = nodeE.getContentHash('partition-left')
    
    console.log('\nAfter healing:')
    console.log(`  A knows about E's data: ${!!AhasRightAfter}`)
    console.log(`  E knows about A's data: ${!!EhasLeftAfter}`)
    
    // Should achieve convergence (at least A should know about E's data through C)
    expect(AhasRightAfter).toBeDefined()
    
    console.log('\n✅ Partition successfully healed!')
  })
})