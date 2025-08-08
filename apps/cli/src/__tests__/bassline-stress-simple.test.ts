/**
 * Simplified Bassline Heavy Stress Test
 * Tests high-volume gossip without filesystem storage issues
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork'
import { BasslineGossip } from '../bassline/BasslineGossip'
import { createMemoryStorage } from '@bassline/storage-memory'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types'
import { Pool } from 'pg'

describe('Bassline Stress Test - Simplified', () => {
  let nodes: BasslineNetwork[] = []
  let gossipLayers: BasslineGossip[] = []
  let pool: Pool
  
  beforeEach(async () => {
    // Setup PostgreSQL with higher connection limit
    pool = new Pool({ database: 'bassline_test', max: 25 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_networks CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_groups CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contacts CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_wires CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_snapshots CASCADE;
    `).catch(() => {})
    client.release()
  })
  
  afterEach(async () => {
    // Cleanup with timeout to avoid hanging
    await Promise.race([
      Promise.all([
        ...gossipLayers.map(g => g.shutdown()),
        ...nodes.map(n => n.shutdown())
      ]),
      new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
    ])
    nodes = []
    gossipLayers = []
    await pool?.end()
  })
  
  /**
   * Create a simple pipeline Bassline
   */
  function createSimplePipelineBassline(groupCount: number): Bassline {
    const groups = new Map()
    const contacts = new Map()
    const wires = new Map()
    
    // Create linear pipeline of groups
    const groupNames: string[] = []
    for (let i = 0; i < groupCount; i++) {
      groupNames.push(`group-${i}`)
    }
    
    // Create groups and contacts
    for (let g = 0; g < groupCount; g++) {
      const groupId = groupNames[g]
      
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `Group ${g}`,
        inputs: g === 0 ? [] : [`${groupId}-in`],
        outputs: [`${groupId}-out`]
      })
      
      // Input contact (except first group)
      if (g > 0) {
        contacts.set(`${groupId}-in`, {
          id: brand.contactId(`${groupId}-in`),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
      
      // Output contact
      contacts.set(`${groupId}-out`, {
        id: brand.contactId(`${groupId}-out`),
        groupId: brand.groupId(groupId),
        blendMode: 'accept-last'
      })
    }
    
    // Create wires connecting groups in pipeline
    for (let g = 0; g < groupCount - 1; g++) {
      const fromGroup = groupNames[g]
      const toGroup = groupNames[g + 1]
      const wireId = `wire-${g}`
      
      wires.set(wireId, {
        id: brand.wireId(wireId),
        fromId: brand.contactId(`${fromGroup}-out`),
        toId: brand.contactId(`${toGroup}-in`),
        type: 'directed'
      })
    }
    
    return {
      id: 'simple-stress-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints: new Map(), // No endpoints - gossip handles connections
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'simple-stress-test'
      }
    }
  }

  it('should handle 5 nodes with memory and postgres storage only', { timeout: 60000 }, async () => {
    console.log('\n=== BASSLINE 5-NODE SIMPLE STRESS TEST ===')
    
    const nodeCount = 5
    const bassline = createSimplePipelineBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes in pipeline...`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    
    // Create nodes with memory and postgres storage only
    for (let i = 0; i < nodeCount; i++) {
      // Alternate between memory and postgres
      const storage = i % 2 === 0 
        ? createMemoryStorage()
        : createPostgresStorage({ 
            options: { database: 'bassline_test' },
            durability: 'performance'
          })
      
      const node = new BasslineNetwork({
        peerId: `node-${i}`,
        endpoint: { url: `ws://localhost:${9500 + i}`, peerId: `node-${i}` },
        storage
      })
      
      // Each node runs one group
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 9500 + i,
        peerId: `node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 5000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
      
      console.log(`✓ Node ${i} ready (${i % 2 === 0 ? 'memory' : 'postgres'} storage)`)
    }
    
    // Connect nodes in pipeline
    console.log('Connecting nodes in pipeline...')
    const connectionPromises = []
    
    for (let i = 1; i < nodeCount; i++) {
      // Connect to previous node
      connectionPromises.push(
        gossipLayers[i].connectToPeer({ 
          url: `ws://localhost:${9500 + i - 1}`, 
          peerId: `node-${i - 1}` 
        }).catch(err => {
          console.warn(`Failed to connect node-${i} to node-${i-1}:`, err.message)
          return null
        })
      )
    }
    
    const results = await Promise.all(connectionPromises)
    const successfulConnections = results.filter(r => r !== null).length
    console.log(`✓ ${successfulConnections}/${connectionPromises.length} connections established`)
    
    // Wait for network stabilization
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('\n=== DATA STREAMING TEST ===')
    const streamStart = Date.now()
    
    // Send updates through the pipeline
    const updatesPerNode = 100
    const totalUpdates = nodeCount * updatesPerNode
    
    console.log(`Streaming ${totalUpdates} updates across ${nodeCount} nodes...`)
    
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
      const node = nodes[nodeIndex]
      const groupName = `group-${nodeIndex}`
      
      for (let i = 0; i < updatesPerNode; i++) {
        const contactId = nodeIndex === 0 ? `${groupName}-out` : 
                          nodeIndex === nodeCount - 1 ? `${groupName}-in` :
                          i % 2 === 0 ? `${groupName}-in` : `${groupName}-out`
        
        const payload = {
          nodeId: nodeIndex,
          sequence: i,
          timestamp: Date.now(),
          data: `payload-${nodeIndex}-${i}`,
          metadata: {
            source: `node-${nodeIndex}`,
            index: i
          }
        }
        
        await node.updateContact(contactId, payload)
        
        // Small delay every 10 updates
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }
    }
    
    const streamTime = Date.now() - streamStart
    const throughput = (totalUpdates * 1000 / streamTime).toFixed(0)
    
    console.log(`✓ Stream complete in ${streamTime}ms`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    
    console.log('\n=== PROPAGATION TEST ===')
    
    // Wait for propagation
    console.log('Waiting for propagation...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Trigger sync
    console.log('Triggering sync...')
    for (let round = 0; round < 3; round++) {
      await Promise.all(gossipLayers.map(g => g['broadcast']?.({ type: 'sync-request', contacts: [] })))
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Check convergence
    console.log('\n=== CONVERGENCE ANALYSIS ===')
    
    const nodeStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      const groupName = `group-${i}`
      
      // Calculate expected contacts for this node (wire-aware)
      const ownContacts = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === groupName)
        .map(([contactId]) => contactId)
      
      const expectedContactIds = new Set(ownContacts)
      
      // Add wire-connected contacts
      for (const [wireId, wire] of bassline.topology.wires) {
        if (ownContacts.includes(wire.fromId)) {
          expectedContactIds.add(wire.toId)
        }
        if (ownContacts.includes(wire.toId)) {
          expectedContactIds.add(wire.fromId)
        }
      }
      
      const expectedCount = expectedContactIds.size
      const actualCount = localContent.size
      const convergence = expectedCount > 0 ? (actualCount / expectedCount * 100) : 0
      
      return {
        nodeId: i,
        group: groupName,
        storage: i % 2 === 0 ? 'memory' : 'postgres',
        actual: actualCount,
        expected: expectedCount,
        convergence: convergence.toFixed(1)
      }
    })
    
    console.log('Node | Group   | Storage  | Got/Exp | Convergence')
    console.log('-----|---------|----------|---------|------------')
    nodeStats.forEach(stat => {
      console.log(`${stat.nodeId.toString().padStart(4)} | ${stat.group.padEnd(7)} | ${stat.storage.padEnd(8)} | ${stat.actual.toString().padStart(3)}/${stat.expected.toString().padStart(3)} | ${stat.convergence.padStart(6)}%`)
    })
    
    const avgConvergence = nodeStats.reduce((sum, stat) => sum + parseFloat(stat.convergence), 0) / nodeCount
    const minConvergence = Math.min(...nodeStats.map(s => parseFloat(s.convergence)))
    
    console.log(`\nAverage convergence: ${avgConvergence.toFixed(1)}%`)
    console.log(`Minimum convergence: ${minConvergence.toFixed(1)}%`)
    
    // For a simple pipeline, we expect high convergence
    expect(avgConvergence).toBeGreaterThan(70) // 70%+ average convergence
    expect(minConvergence).toBeGreaterThan(50) // No node below 50%
    expect(parseFloat(throughput)).toBeGreaterThan(500) // 500+ updates/sec for small scale
    
    console.log('\n✅ Simple stress test passed!')
  })

  it('should handle 10 nodes with high throughput', { timeout: 120000 }, async () => {
    console.log('\n=== BASSLINE 10-NODE HIGH THROUGHPUT TEST ===')
    
    const nodeCount = 10
    const bassline = createSimplePipelineBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes in pipeline...`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    
    // Create nodes - all memory for maximum speed
    for (let i = 0; i < nodeCount; i++) {
      const storage = createMemoryStorage()
      
      const node = new BasslineNetwork({
        peerId: `node-${i}`,
        endpoint: { url: `ws://localhost:${9600 + i}`, peerId: `node-${i}` },
        storage
      })
      
      // Each node runs one group
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 9600 + i,
        peerId: `node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 10000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
    }
    
    console.log(`✓ All ${nodeCount} nodes ready (memory storage)`)
    
    // Connect nodes in pipeline with redundancy
    console.log('Connecting nodes...')
    const connectionPromises = []
    
    for (let i = 1; i < nodeCount; i++) {
      // Connect to previous node
      connectionPromises.push(
        gossipLayers[i].connectToPeer({ 
          url: `ws://localhost:${9600 + i - 1}`, 
          peerId: `node-${i - 1}` 
        }).catch(err => null)
      )
      
      // Also connect to node 2 back for redundancy (if possible)
      if (i >= 2) {
        connectionPromises.push(
          gossipLayers[i].connectToPeer({ 
            url: `ws://localhost:${9600 + i - 2}`, 
            peerId: `node-${i - 2}` 
          }).catch(err => null)
        )
      }
    }
    
    const results = await Promise.all(connectionPromises)
    const successfulConnections = results.filter(r => r !== null).length
    console.log(`✓ ${successfulConnections}/${connectionPromises.length} connections established`)
    
    // Wait for network stabilization
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('\n=== MASSIVE DATA STREAMING TEST ===')
    const streamStart = Date.now()
    
    // Send many updates in parallel
    const updatesPerNode = 1000
    const batchSize = 100
    const totalUpdates = nodeCount * updatesPerNode
    
    console.log(`Streaming ${totalUpdates} updates (${updatesPerNode} per node)...`)
    
    const updatePromises = []
    
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
      const node = nodes[nodeIndex]
      const groupName = `group-${nodeIndex}`
      
      // Send updates in batches for this node
      for (let batch = 0; batch < updatesPerNode / batchSize; batch++) {
        for (let i = 0; i < batchSize; i++) {
          const seq = batch * batchSize + i
          const contactId = seq % 2 === 0 && nodeIndex > 0 ? `${groupName}-in` : `${groupName}-out`
          
          const payload = {
            nodeId: nodeIndex,
            sequence: seq,
            timestamp: Date.now(),
            batch: batch,
            data: Buffer.from(`data-${nodeIndex}-${seq}`).toString('base64')
          }
          
          updatePromises.push(
            node.updateContact(contactId, payload).catch(err => {
              console.error(`Update failed for node ${nodeIndex}, seq ${seq}:`, err.message)
              return null
            })
          )
        }
        
        // Process batch
        if (updatePromises.length >= 500) {
          await Promise.all(updatePromises.splice(0, 500))
          await new Promise(resolve => setTimeout(resolve, 10)) // Small delay between batches
        }
      }
    }
    
    // Process remaining updates
    await Promise.all(updatePromises)
    
    const streamTime = Date.now() - streamStart
    const throughput = (totalUpdates * 1000 / streamTime).toFixed(0)
    
    console.log(`✓ Stream complete in ${streamTime}ms`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    console.log(`  Data volume: ~${(totalUpdates * 0.1).toFixed(1)}KB`)
    
    console.log('\n=== CONVERGENCE MEASUREMENT ===')
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Check convergence
    const nodeStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      const groupName = `group-${i}`
      
      // Calculate expected contacts for this node
      const ownContacts = Array.from(bassline.topology.contacts.entries())
        .filter(([_, contact]) => contact.groupId === groupName)
        .map(([contactId]) => contactId)
      
      const expectedContactIds = new Set(ownContacts)
      
      // Add wire-connected contacts
      for (const [wireId, wire] of bassline.topology.wires) {
        if (ownContacts.includes(wire.fromId)) {
          expectedContactIds.add(wire.toId)
        }
        if (ownContacts.includes(wire.toId)) {
          expectedContactIds.add(wire.fromId)
        }
      }
      
      const expectedCount = expectedContactIds.size
      const actualCount = localContent.size
      const convergence = expectedCount > 0 ? (actualCount / expectedCount * 100) : 0
      
      return { nodeId: i, convergence: convergence.toFixed(1) }
    })
    
    const avgConvergence = nodeStats.reduce((sum, stat) => sum + parseFloat(stat.convergence), 0) / nodeCount
    const minConvergence = Math.min(...nodeStats.map(s => parseFloat(s.convergence)))
    
    console.log(`Average convergence: ${avgConvergence.toFixed(1)}%`)
    console.log(`Minimum convergence: ${minConvergence.toFixed(1)}%`)
    console.log(`Throughput: ${throughput} updates/sec`)
    
    // Performance expectations for 10 nodes
    expect(avgConvergence).toBeGreaterThan(65) // 65%+ average convergence
    expect(minConvergence).toBeGreaterThan(40) // No node below 40%
    expect(parseFloat(throughput)).toBeGreaterThan(2000) // 2000+ updates/sec with memory storage
    
    console.log('\n✅ 10-node high throughput test passed!')
  })
})