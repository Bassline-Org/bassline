/**
 * Test peer discovery functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GossipLayer } from '../runtime/GossipLayer'
import { createMemoryStorage } from '@bassline/storage-memory'

describe('Gossip peer discovery', () => {
  let nodes: GossipLayer[] = []
  
  afterEach(async () => {
    await Promise.all(nodes.map(n => n.stop()))
    nodes = []
  })

  it('should discover peers through announcements', { timeout: 20000 }, async () => {
    console.log('\n=== PEER DISCOVERY TEST ===')
    
    // Create three nodes in a chain: A -> B -> C
    // A only knows about B, C only knows about B
    // They should discover each other through B
    
    const nodeA = new GossipLayer({
      id: 'A',
      port: 7001,
      storage: createMemoryStorage(),
      syncInterval: 1000,
      peerExchangeInterval: 500 // Fast exchange for testing
    })
    
    const nodeB = new GossipLayer({
      id: 'B',
      port: 7002,
      storage: createMemoryStorage(),
      syncInterval: 1000,
      peerExchangeInterval: 500
    })
    
    const nodeC = new GossipLayer({
      id: 'C',
      port: 7003,
      storage: createMemoryStorage(),
      syncInterval: 1000,
      peerExchangeInterval: 500
    })
    
    nodes = [nodeA, nodeB, nodeC]
    
    // Start B first (the hub)
    console.log('Starting node B (hub)...')
    await nodeB.start()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Start A connecting to B
    console.log('Starting node A connecting to B...')
    nodeA.config.peers = ['ws://localhost:7002']
    await nodeA.start()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Start C connecting to B
    console.log('Starting node C connecting to B...')
    nodeC.config.peers = ['ws://localhost:7002']
    await nodeC.start()
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Wait for initial connections
    console.log('Waiting for initial connections...')
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Add some contacts to each node
    await nodeA.updateContact('dataA', { value: 'from A' })
    await nodeB.updateContact('dataB', { value: 'from B' })
    await nodeC.updateContact('dataC', { value: 'from C' })
    
    // Wait for peer exchange to happen
    console.log('Waiting for peer discovery...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Check if nodes discovered each other's data
    console.log('\nChecking data propagation:')
    
    const aHasB = nodeA.getContentHash('dataB')
    const aHasC = nodeA.getContentHash('dataC')
    const bHasA = nodeB.getContentHash('dataA')
    const bHasC = nodeB.getContentHash('dataC')
    const cHasA = nodeC.getContentHash('dataA')
    const cHasB = nodeC.getContentHash('dataB')
    
    console.log(`Node A has B's data: ${!!aHasB}`)
    console.log(`Node A has C's data: ${!!aHasC}`)
    console.log(`Node B has A's data: ${!!bHasA}`)
    console.log(`Node B has C's data: ${!!bHasC}`)
    console.log(`Node C has A's data: ${!!cHasA}`)
    console.log(`Node C has B's data: ${!!cHasB}`)
    
    // All nodes should have all data
    expect(aHasB).toBeTruthy()
    expect(aHasC).toBeTruthy()
    expect(bHasA).toBeTruthy()
    expect(bHasC).toBeTruthy()
    expect(cHasA).toBeTruthy()
    expect(cHasB).toBeTruthy()
  })
  
  it('should share contact awareness in peer info', { timeout: 15000 }, async () => {
    console.log('\n=== CONTACT AWARENESS TEST ===')
    
    // Create two nodes
    const node1 = new GossipLayer({
      id: 'node1',
      port: 7010,
      storage: createMemoryStorage(),
      syncInterval: 1000,
      peerExchangeInterval: 500
    })
    
    const node2 = new GossipLayer({
      id: 'node2',
      port: 7011,
      storage: createMemoryStorage(),
      peers: ['ws://localhost:7010'],
      syncInterval: 1000,
      peerExchangeInterval: 500
    })
    
    nodes = [node1, node2]
    
    await node1.start()
    await node2.start()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Node1 creates some contacts
    console.log('Node1 creating contacts...')
    for (let i = 0; i < 5; i++) {
      await node1.updateContact(`contact1-${i}`, { value: i })
    }
    
    // Node2 creates different contacts
    console.log('Node2 creating contacts...')
    for (let i = 0; i < 5; i++) {
      await node2.updateContact(`contact2-${i}`, { value: i })
    }
    
    // Wait for peer exchange
    console.log('Waiting for peer exchange with contact info...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Trigger sync
    await node1.triggerSync()
    await node2.triggerSync()
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Check if they exchanged all contacts
    console.log('\nChecking contact exchange:')
    let node1Has2 = 0
    let node2Has1 = 0
    
    for (let i = 0; i < 5; i++) {
      if (node1.getContentHash(`contact2-${i}`)) node1Has2++
      if (node2.getContentHash(`contact1-${i}`)) node2Has1++
    }
    
    console.log(`Node1 has ${node1Has2}/5 of Node2's contacts`)
    console.log(`Node2 has ${node2Has1}/5 of Node1's contacts`)
    
    expect(node1Has2).toBe(5)
    expect(node2Has1).toBe(5)
  })
})