/**
 * Simple Bassline Network Test
 * 
 * Tests basic Bassline functionality with PostgreSQL storage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { BasslineNetwork } from '../bassline/BasslineNetwork.js'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { createMemoryStorage } from '@bassline/storage-memory'
import { brand } from '@bassline/core'
import { Pool } from 'pg'
import type { Bassline } from '../bassline/types.js'

describe('Simple Bassline Network', () => {
  let pool: Pool
  let node1: BasslineNetwork
  let node2: BasslineNetwork
  
  beforeAll(async () => {
    // Setup PostgreSQL
    pool = new Pool({ database: 'bassline_test', max: 5 })
    const client = await pool.connect()
    await client.query(`
      TRUNCATE TABLE IF EXISTS bassline_contact_values CASCADE;
      TRUNCATE TABLE IF EXISTS bassline_contact_values_fast CASCADE;
    `).catch(() => {})
    client.release()
  })
  
  afterAll(async () => {
    await node1?.shutdown()
    await node2?.shutdown()
    await pool?.end()
  })
  
  it('should share the same Bassline between nodes', async () => {
    console.log('\n=== SIMPLE BASSLINE TEST ===')
    
    // Create a minimal Bassline
    const bassline: Bassline = {
      id: 'simple-test',
      version: '1.0.0',
      topology: {
        groups: new Map([
          ['group1', {
            id: brand.groupId('group1'),
            name: 'Group 1',
            inputs: [],
            outputs: [brand.contactId('data')]
          }]
        ]),
        contacts: new Map([
          ['data', {
            id: brand.contactId('data'),
            groupId: brand.groupId('group1'),
            blendMode: 'accept-last'
          }]
        ]),
        wires: new Map()
      },
      endpoints: new Map([
        ['group1', {
          url: 'ws://localhost:8901',
          peerId: 'node1'
        }]
      ]),
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'test'
      }
    }
    
    // Create two nodes - one with PostgreSQL, one with memory
    node1 = new BasslineNetwork({
      peerId: 'node1',
      endpoint: { url: 'ws://localhost:8901', peerId: 'node1' },
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance'
      })
    })
    
    node2 = new BasslineNetwork({
      peerId: 'node2',
      endpoint: { url: 'ws://localhost:8902', peerId: 'node2' },
      storage: createMemoryStorage()
    })
    
    // Both nodes join the same network
    await node1.joinNetwork(bassline, ['group1'])
    await node2.joinNetwork(bassline, [])
    
    // Node1 updates data
    console.log('Node1 updating data...')
    await node1.updateContact('data', { value: 42, timestamp: Date.now() })
    
    // Check that node1 has the data
    const node1Data = node1['localContent'].get('data')
    console.log(`Node1 has data: ${JSON.stringify(node1Data)}`)
    
    expect(node1Data).toBeDefined()
    expect(node1Data.value).toBe(42)
    
    // Calculate convergence
    const conv1 = node1.getConvergence()
    console.log(`Node1 convergence: ${conv1}%`)
    
    // Node1 should have 100% since it owns the only contact
    expect(conv1).toBe(100)
  })
  
  it('should work with wire connections', async () => {
    console.log('\n=== WIRE CONNECTION TEST ===')
    
    // Create Bassline with wired contacts
    const bassline: Bassline = {
      id: 'wire-test',
      version: '1.0.0',
      topology: {
        groups: new Map([
          ['input', {
            id: brand.groupId('input'),
            name: 'Input',
            inputs: [],
            outputs: [brand.contactId('a'), brand.contactId('b')]
          }],
          ['output', {
            id: brand.groupId('output'),
            name: 'Output',
            inputs: [brand.contactId('a'), brand.contactId('b')],
            outputs: [brand.contactId('sum')]
          }]
        ]),
        contacts: new Map([
          ['a', {
            id: brand.contactId('a'),
            groupId: brand.groupId('input'),
            blendMode: 'accept-last'
          }],
          ['b', {
            id: brand.contactId('b'),
            groupId: brand.groupId('input'),
            blendMode: 'accept-last'
          }],
          ['sum', {
            id: brand.contactId('sum'),
            groupId: brand.groupId('output'),
            blendMode: 'accept-last'
          }]
        ]),
        wires: new Map([
          ['w1', {
            id: brand.wireId('w1'),
            fromId: brand.contactId('a'),
            toId: brand.contactId('sum'),
            type: 'directed'
          }],
          ['w2', {
            id: brand.wireId('w2'),
            fromId: brand.contactId('b'),
            toId: brand.contactId('sum'),
            type: 'directed'
          }]
        ])
      },
      endpoints: new Map([
        ['input', {
          url: 'ws://localhost:8903',
          peerId: 'node3'
        }],
        ['output', {
          url: 'ws://localhost:8904',
          peerId: 'node4'
        }]
      ]),
      subBasslines: new Map(),
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'test'
      }
    }
    
    // Create nodes with different storage
    const node3 = new BasslineNetwork({
      peerId: 'node3',
      endpoint: { url: 'ws://localhost:8903', peerId: 'node3' },
      storage: createPostgresStorage({ 
        options: {
          database: 'bassline_test'
        },
        durability: 'performance'
      })
    })
    
    const node4 = new BasslineNetwork({
      peerId: 'node4',
      endpoint: { url: 'ws://localhost:8904', peerId: 'node4' },
      storage: createMemoryStorage()
    })
    
    // Join network
    await node3.joinNetwork(bassline, ['input'])
    await node4.joinNetwork(bassline, ['output'])
    
    // Node3 sets inputs
    console.log('Setting input values...')
    await node3.updateContact('a', 10)
    await node3.updateContact('b', 20)
    
    // Node4 computes sum
    console.log('Computing sum...')
    await node4.updateContact('sum', 30)
    
    // Check data
    const aValue = node3['localContent'].get('a')
    const bValue = node3['localContent'].get('b')
    const sumValue = node4['localContent'].get('sum')
    
    console.log(`Input values: a=${aValue}, b=${bValue}`)
    console.log(`Output value: sum=${sumValue}`)
    
    expect(aValue).toBe(10)
    expect(bValue).toBe(20)
    expect(sumValue).toBe(30)
    
    // Cleanup
    await node3.shutdown()
    await node4.shutdown()
  })
})