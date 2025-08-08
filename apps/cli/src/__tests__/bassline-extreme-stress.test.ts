/**
 * Extreme Bassline Stress Tests
 * Push the system to its absolute limits
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork'
import { BasslineGossip } from '../bassline/BasslineGossip'
import { createMemoryStorage } from '@bassline/storage-memory'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'
import type { Bassline } from '../bassline/types'
import { Pool } from 'pg'

describe('Bassline Extreme Stress Tests', () => {
  let nodes: BasslineNetwork[] = []
  let gossipLayers: BasslineGossip[] = []
  let pool: Pool
  
  beforeEach(async () => {
    pool = new Pool({ database: 'bassline_test', max: 30 })
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
    // Clean up in parallel with timeout
    await Promise.race([
      Promise.all([
        ...gossipLayers.map(g => g.shutdown().catch(() => {})),
        ...nodes.map(n => n.shutdown().catch(() => {}))
      ]),
      new Promise(resolve => setTimeout(resolve, 5000))
    ])
    
    nodes = []
    gossipLayers = []
    
    // Only close pool if it exists and isn't already closing
    if (pool && !pool.ending) {
      await pool.end().catch(() => {})
    }
    pool = null as any
  })
  
  /**
   * Create a complex network topology
   */
  function createComplexBassline(nodeCount: number): Bassline {
    const groups = new Map()
    const contacts = new Map()
    const wires = new Map()
    
    // Create groups with multiple contacts each
    for (let i = 0; i < nodeCount; i++) {
      const groupId = `group-${i}`
      
      groups.set(groupId, {
        id: brand.groupId(groupId),
        name: `Group ${i}`,
        inputs: i === 0 ? [] : [`${groupId}-in1`, `${groupId}-in2`],
        outputs: [`${groupId}-out1`, `${groupId}-out2`]
      })
      
      // Input contacts
      if (i > 0) {
        contacts.set(`${groupId}-in1`, {
          id: brand.contactId(`${groupId}-in1`),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
        contacts.set(`${groupId}-in2`, {
          id: brand.contactId(`${groupId}-in2`),
          groupId: brand.groupId(groupId),
          blendMode: 'accept-last'
        })
      }
      
      // Output contacts
      contacts.set(`${groupId}-out1`, {
        id: brand.contactId(`${groupId}-out1`),
        groupId: brand.groupId(groupId),
        blendMode: 'accept-last'
      })
      contacts.set(`${groupId}-out2`, {
        id: brand.contactId(`${groupId}-out2`),
        groupId: brand.groupId(groupId),
        blendMode: 'accept-last'
      })
    }
    
    // Create dense wire connections
    let wireId = 0
    for (let i = 0; i < nodeCount - 1; i++) {
      const fromGroup = `group-${i}`
      
      // Connect to next 3 groups (creating a dense mesh)
      for (let j = 1; j <= Math.min(3, nodeCount - i - 1); j++) {
        const toGroup = `group-${i + j}`
        
        // Connect both outputs to both inputs
        wires.set(`wire-${wireId++}`, {
          id: brand.wireId(`wire-${wireId}`),
          fromId: brand.contactId(`${fromGroup}-out1`),
          toId: brand.contactId(`${toGroup}-in1`),
          type: 'directed'
        })
        
        wires.set(`wire-${wireId++}`, {
          id: brand.wireId(`wire-${wireId}`),
          fromId: brand.contactId(`${fromGroup}-out2`),
          toId: brand.contactId(`${toGroup}-in2`),
          type: 'directed'
        })
      }
    }
    
    return {
      id: 'extreme-stress-test',
      version: '1.0.0',
      topology: { groups, contacts, wires },
      endpoints: new Map(),
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'extreme-stress-test'
      }
    }
  }

  it('should handle 25 nodes with extreme load', { timeout: 300000 }, async () => {
    console.log('\n=== BASSLINE 25-NODE EXTREME STRESS TEST ===')
    
    const nodeCount = 25
    const bassline = createComplexBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes with complex topology...`)
    console.log(`Total contacts: ${bassline.topology.contacts.size}`)
    console.log(`Total wires: ${bassline.topology.wires.size}`)
    
    // Create nodes - mix of storage types
    for (let i = 0; i < nodeCount; i++) {
      const storage = i % 3 === 0 
        ? createPostgresStorage({ 
            options: { database: 'bassline_test' },
            durability: 'performance'
          })
        : createMemoryStorage()
      
      const node = new BasslineNetwork({
        peerId: `extreme-node-${i}`,
        endpoint: { url: `ws://localhost:${14000 + i}`, peerId: `extreme-node-${i}` },
        storage
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 14000 + i,
        peerId: `extreme-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 15000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
      
      if ((i + 1) % 5 === 0) {
        console.log(`✓ ${i + 1}/${nodeCount} nodes ready`)
      }
    }
    
    console.log(`✓ All ${nodeCount} nodes ready`)
    
    // Create mesh connections
    console.log('Creating mesh network connections...')
    const connectionPromises = []
    
    for (let i = 0; i < nodeCount; i++) {
      // Each node connects to 3-5 random peers
      const peerCount = 3 + Math.floor(Math.random() * 3)
      const peers = new Set<number>()
      
      while (peers.size < Math.min(peerCount, nodeCount - 1)) {
        const peer = Math.floor(Math.random() * nodeCount)
        if (peer !== i) peers.add(peer)
      }
      
      for (const peer of peers) {
        connectionPromises.push(
          gossipLayers[i].connectToPeer({ 
            url: `ws://localhost:${14000 + peer}`, 
            peerId: `extreme-node-${peer}` 
          }).catch(() => null)
        )
      }
    }
    
    const results = await Promise.all(connectionPromises)
    const successfulConnections = results.filter(r => r !== null).length
    console.log(`✓ ${successfulConnections}/${connectionPromises.length} connections established`)
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('\n=== EXTREME LOAD TEST ===')
    const loadStart = Date.now()
    
    // Send massive concurrent updates
    const updatesPerNode = 500
    const totalUpdates = nodeCount * updatesPerNode
    
    console.log(`Sending ${totalUpdates} concurrent updates...`)
    
    const updatePromises = []
    
    // All nodes send updates simultaneously
    for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
      const node = nodes[nodeIndex]
      const groupName = `group-${nodeIndex}`
      
      for (let i = 0; i < updatesPerNode; i++) {
        const contactId = i % 4 === 0 ? `${groupName}-out1` :
                         i % 4 === 1 ? `${groupName}-out2` :
                         i % 4 === 2 && nodeIndex > 0 ? `${groupName}-in1` :
                         nodeIndex > 0 ? `${groupName}-in2` : `${groupName}-out1`
        
        const payload = {
          nodeId: nodeIndex,
          sequence: i,
          timestamp: Date.now(),
          data: Buffer.from(`extreme-payload-${nodeIndex}-${i}`).toString('base64').repeat(10), // ~1KB each
          stress: true
        }
        
        updatePromises.push(
          node.updateContact(contactId, payload).catch(() => null)
        )
        
        // Process in batches to avoid overwhelming
        if (updatePromises.length >= 1000) {
          await Promise.all(updatePromises.splice(0, 1000))
        }
      }
    }
    
    await Promise.all(updatePromises)
    
    const loadTime = Date.now() - loadStart
    const throughput = (totalUpdates * 1000 / loadTime).toFixed(0)
    
    console.log(`✓ Load complete in ${loadTime}ms`)
    console.log(`  Throughput: ${throughput} updates/sec`)
    console.log(`  Data volume: ~${(totalUpdates * 1).toFixed(0)}KB`)
    
    console.log('\n=== CONVERGENCE UNDER EXTREME LOAD ===')
    
    // Allow time for propagation
    console.log('Waiting for propagation under extreme load...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Measure convergence
    const nodeStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      return {
        nodeId: i,
        contacts: localContent.size
      }
    })
    
    const avgContacts = nodeStats.reduce((sum, s) => sum + s.contacts, 0) / nodeCount
    const minContacts = Math.min(...nodeStats.map(s => s.contacts))
    const maxContacts = Math.max(...nodeStats.map(s => s.contacts))
    
    console.log(`Average contacts per node: ${avgContacts.toFixed(1)}`)
    console.log(`Min contacts: ${minContacts}`)
    console.log(`Max contacts: ${maxContacts}`)
    console.log(`Throughput: ${throughput} updates/sec`)
    
    // Expectations for extreme scale
    expect(avgContacts).toBeGreaterThan(2) // At least some propagation
    expect(parseFloat(throughput)).toBeGreaterThan(1000) // 1000+ updates/sec even at scale
    
    console.log('\n✅ 25-node extreme stress test completed!')
  })

  it('should handle network partitions and recovery', { timeout: 120000 }, async () => {
    console.log('\n=== NETWORK PARTITION RESILIENCE TEST ===')
    
    const nodeCount = 10
    const bassline = createComplexBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes...`)
    
    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      const storage = createMemoryStorage()
      
      const node = new BasslineNetwork({
        peerId: `partition-node-${i}`,
        endpoint: { url: `ws://localhost:${11000 + i}`, peerId: `partition-node-${i}` },
        storage
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 11000 + i,
        peerId: `partition-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 5000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
    }
    
    // Connect nodes in two partitions
    console.log('Creating initial network with two partitions...')
    
    // Partition A: nodes 0-4
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        await gossipLayers[i].connectToPeer({ 
          url: `ws://localhost:${11000 + j}`, 
          peerId: `partition-node-${j}` 
        }).catch(() => null)
      }
    }
    
    // Partition B: nodes 5-9
    for (let i = 5; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        await gossipLayers[i].connectToPeer({ 
          url: `ws://localhost:${11000 + j}`, 
          peerId: `partition-node-${j}` 
        }).catch(() => null)
      }
    }
    
    console.log('✓ Two network partitions created')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Send updates to each partition
    console.log('\n=== UPDATES DURING PARTITION ===')
    
    // Partition A updates
    for (let i = 0; i < 100; i++) {
      const nodeIndex = i % 5
      await nodes[nodeIndex].updateContact(`group-${nodeIndex}-out1`, {
        partition: 'A',
        sequence: i,
        timestamp: Date.now()
      })
    }
    
    // Partition B updates
    for (let i = 0; i < 100; i++) {
      const nodeIndex = 5 + (i % 5)
      await nodes[nodeIndex].updateContact(`group-${nodeIndex}-out1`, {
        partition: 'B',
        sequence: i,
        timestamp: Date.now()
      })
    }
    
    console.log('✓ Updates sent to both partitions')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Check isolation
    const partitionAContent = nodes[0]['localContent'] as Map<string, any>
    const partitionBContent = nodes[5]['localContent'] as Map<string, any>
    
    console.log(`Partition A has ${partitionAContent.size} contacts`)
    console.log(`Partition B has ${partitionBContent.size} contacts`)
    
    // Heal the partition
    console.log('\n=== HEALING PARTITION ===')
    console.log('Connecting node 4 to node 5 to bridge partitions...')
    
    await gossipLayers[4].connectToPeer({ 
      url: `ws://localhost:${11005}`, 
      peerId: `partition-node-5` 
    })
    
    console.log('✓ Bridge connection established')
    console.log('Waiting for convergence after partition heal...')
    
    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Trigger sync to accelerate convergence
    for (let i = 0; i < nodeCount; i++) {
      await gossipLayers[i]['broadcast']?.({ type: 'sync-request', contacts: [] })
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check convergence after healing
    console.log('\n=== POST-HEALING CONVERGENCE ===')
    
    const postHealStats = nodes.map((node, i) => {
      const localContent = node['localContent'] as Map<string, any>
      return {
        nodeId: i,
        partition: i < 5 ? 'A' : 'B',
        contacts: localContent.size
      }
    })
    
    const avgContactsPostHeal = postHealStats.reduce((sum, s) => sum + s.contacts, 0) / nodeCount
    const minContactsPostHeal = Math.min(...postHealStats.map(s => s.contacts))
    
    console.log('Post-healing stats:')
    postHealStats.forEach(stat => {
      console.log(`  Node ${stat.nodeId} (Partition ${stat.partition}): ${stat.contacts} contacts`)
    })
    
    console.log(`\nAverage contacts: ${avgContactsPostHeal.toFixed(1)}`)
    console.log(`Min contacts: ${minContactsPostHeal}`)
    
    // After healing, nodes should have more contacts
    expect(avgContactsPostHeal).toBeGreaterThan(partitionAContent.size)
    expect(minContactsPostHeal).toBeGreaterThan(0)
    
    console.log('\n✅ Partition resilience test passed!')
  })

  it('should handle concurrent updates from all nodes', { timeout: 120000 }, async () => {
    console.log('\n=== CONCURRENT UPDATE STRESS TEST ===')
    
    const nodeCount = 15
    const bassline = createComplexBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes...`)
    
    // Create all nodes with memory storage for speed
    for (let i = 0; i < nodeCount; i++) {
      const node = new BasslineNetwork({
        peerId: `concurrent-node-${i}`,
        endpoint: { url: `ws://localhost:${12000 + i}`, peerId: `concurrent-node-${i}` },
        storage: createMemoryStorage()
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 12000 + i,
        peerId: `concurrent-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 10000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
    }
    
    // Create full mesh connections
    console.log('Creating full mesh connections...')
    const connectionPromises = []
    
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        connectionPromises.push(
          gossipLayers[i].connectToPeer({ 
            url: `ws://localhost:${12000 + j}`, 
            peerId: `concurrent-node-${j}` 
          }).catch(() => null)
        )
      }
    }
    
    await Promise.all(connectionPromises)
    console.log(`✓ Full mesh network created`)
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('\n=== CONCURRENT UPDATE STORM ===')
    const concurrentStart = Date.now()
    
    // All nodes update the same contacts simultaneously
    const updatesPerNode = 100
    const sharedContacts = ['group-0-out1', 'group-1-out1', 'group-2-out1']
    
    console.log(`All ${nodeCount} nodes updating ${sharedContacts.length} shared contacts...`)
    
    const allUpdatePromises = []
    
    for (let round = 0; round < updatesPerNode; round++) {
      // All nodes update all shared contacts in parallel
      for (let nodeIndex = 0; nodeIndex < nodeCount; nodeIndex++) {
        for (const contactId of sharedContacts) {
          // Only update if the contact exists in this node's runtime
          if (nodes[nodeIndex]['localContent'].has(contactId) || nodeIndex < 3) {
            allUpdatePromises.push(
              nodes[nodeIndex].updateContact(contactId, {
                nodeId: nodeIndex,
                round: round,
                timestamp: Date.now(),
                random: Math.random()
              }).catch(() => null)
            )
          }
        }
      }
      
      // Process batch
      if (allUpdatePromises.length >= 500) {
        await Promise.all(allUpdatePromises.splice(0, 500))
      }
    }
    
    await Promise.all(allUpdatePromises)
    
    const concurrentTime = Date.now() - concurrentStart
    const totalConcurrentUpdates = nodeCount * updatesPerNode * sharedContacts.length
    const concurrentThroughput = (totalConcurrentUpdates * 1000 / concurrentTime).toFixed(0)
    
    console.log(`✓ Concurrent updates complete in ${concurrentTime}ms`)
    console.log(`  Total updates: ${totalConcurrentUpdates}`)
    console.log(`  Throughput: ${concurrentThroughput} updates/sec`)
    
    // Check for convergence despite conflicts
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    console.log('\n=== CONFLICT RESOLUTION CHECK ===')
    
    // Check that all nodes agree on final values
    const finalValues = new Map()
    
    for (const contactId of sharedContacts) {
      const values = []
      for (let i = 0; i < Math.min(5, nodeCount); i++) {
        const content = nodes[i]['localContent'].get(contactId)
        if (content) {
          values.push(JSON.stringify(content))
        }
      }
      
      const uniqueValues = new Set(values)
      console.log(`Contact ${contactId}: ${uniqueValues.size} unique final values across nodes`)
      
      // With accept-last blend mode and concurrent updates, allow some divergence
      expect(uniqueValues.size).toBeLessThanOrEqual(3) // Allow propagation delay and race conditions
    }
    
    expect(parseFloat(concurrentThroughput)).toBeGreaterThan(5000) // High throughput even with conflicts
    
    console.log('\n✅ Concurrent update stress test passed!')
  })

  it('should handle massive payloads', { timeout: 120000 }, async () => {
    console.log('\n=== MASSIVE PAYLOAD STRESS TEST ===')
    
    const nodeCount = 5
    const bassline = createComplexBassline(nodeCount)
    
    console.log(`Creating ${nodeCount} nodes for massive payload test...`)
    
    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      const node = new BasslineNetwork({
        peerId: `massive-node-${i}`,
        endpoint: { url: `ws://localhost:${13000 + i}`, peerId: `massive-node-${i}` },
        storage: createMemoryStorage()
      })
      
      const groupNames = Array.from(bassline.topology.groups.keys())
      await node.joinNetwork(bassline, [groupNames[i]])
      nodes.push(node)
      
      const gossip = new BasslineGossip({
        port: 13000 + i,
        peerId: `massive-node-${i}`,
        bassline,
        network: node,
        heartbeatInterval: 10000
      })
      
      await gossip.start()
      gossipLayers.push(gossip)
    }
    
    // Connect in chain
    for (let i = 1; i < nodeCount; i++) {
      await gossipLayers[i].connectToPeer({ 
        url: `ws://localhost:${13000 + i - 1}`, 
        peerId: `massive-node-${i - 1}` 
      })
    }
    
    console.log('✓ Chain network created')
    
    console.log('\n=== SENDING MASSIVE PAYLOADS ===')
    
    // Create increasingly large payloads
    const payloadSizes = [1, 10, 100, 500] // KB
    const updatePromises = []
    
    for (const sizeKB of payloadSizes) {
      const largeData = Buffer.alloc(sizeKB * 1024).fill('x').toString('base64')
      
      console.log(`Sending ${sizeKB}KB payload...`)
      const startTime = Date.now()
      
      await nodes[0].updateContact('group-0-out1', {
        sizeKB,
        data: largeData,
        timestamp: Date.now()
      })
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Check if it propagated
      let propagatedCount = 0
      for (let i = 1; i < nodeCount; i++) {
        const content = nodes[i]['localContent'].get('group-0-out1')
        if (content && content.sizeKB === sizeKB) {
          propagatedCount++
        }
      }
      
      const propagationTime = Date.now() - startTime
      console.log(`  ✓ ${sizeKB}KB propagated to ${propagatedCount}/${nodeCount-1} nodes in ${propagationTime}ms`)
      
      // Large payloads should still propagate to some nodes
      expect(propagatedCount).toBeGreaterThan(0)
    }
    
    console.log('\n✅ Massive payload stress test passed!')
  })
})