/**
 * Basic PostgreSQL Storage Verification Test
 * 
 * Tests the fundamental storage operations directly without networking layers
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createPostgresStorage } from '@bassline/storage-postgres'
import { brand } from '@bassline/core'
import { Pool } from 'pg'

describe('PostgreSQL Storage Verification', () => {
  let pool: Pool
  
  beforeEach(async () => {
    // Setup PostgreSQL
    pool = new Pool({ database: 'bassline_test', max: 5 })
    const client = await pool.connect()
    
    // Clear all tables
    await client.query(`
      DELETE FROM bassline_contacts;
      DELETE FROM bassline_groups;
      DELETE FROM bassline_networks;
    `).catch(() => {})
    client.release()
  })

  it('should save and load a single contact directly', async () => {
    console.log('\n=== DIRECT STORAGE TEST ===')
    
    const storage = createPostgresStorage({ 
      options: {
        database: 'bassline_test'
      },
      durability: 'performance'
    })

    // Test data
    const networkId = brand.networkId('test-network')
    const groupId = brand.groupId('test-group')
    const contactId = brand.contactId('test-contact')
    const testContent = { message: 'Hello, Storage!', timestamp: Date.now() }

    console.log('1. Initialize storage...')
    if (storage.initialize) {
      const initResult = await storage.initialize()
      expect(initResult.ok).toBe(true)
      console.log('   ✓ Storage initialized')
    }

    console.log('2. Save network state...')
    const networkState = {
      networkId,
      groups: new Map(),
      wires: new Map()
    }
    
    const saveNetworkResult = await storage.saveNetworkState(networkId, networkState as any)
    if (!saveNetworkResult.ok) {
      console.log('   Network save result:', saveNetworkResult)
    }
    expect(saveNetworkResult.ok).toBe(true)
    console.log('   ✓ Network state saved')

    console.log('3. Save group state first (required for foreign key)...')
    const groupState = {
      group: {
        id: groupId,
        name: 'Test Group',
        contactIds: [contactId],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      },
      contacts: new Map([[contactId, { content: testContent }]]),
      wires: new Map()
    }
    
    const saveGroupResult = await storage.saveGroupState(networkId, groupId, groupState as any)
    if (!saveGroupResult.ok) {
      console.log('   Group save error:', saveGroupResult.error)
    }
    expect(saveGroupResult.ok).toBe(true)
    console.log('   ✓ Group state saved')

    console.log('4. Save contact content...')
    const saveContactResult = await storage.saveContactContent(
      networkId,
      groupId, 
      contactId,
      testContent
    )
    
    if (!saveContactResult.ok) {
      console.log('   Contact save error:', saveContactResult.error)
    }
    expect(saveContactResult.ok).toBe(true)
    console.log('   ✓ Contact saved')

    console.log('5. Verify data in database...')
    const client = await pool.connect()
    
    // Check all tables to see what data exists
    const allNetworks = await client.query('SELECT id FROM bassline_networks')
    const allGroups = await client.query('SELECT network_id, group_id FROM bassline_groups')
    const allContacts = await client.query('SELECT network_id, group_id, contact_id FROM bassline_contacts')
    
    console.log(`   Total networks in DB: ${allNetworks.rows.length}`)
    console.log(`   Total groups in DB: ${allGroups.rows.length}`)
    console.log(`   Total contacts in DB: ${allContacts.rows.length}`)
    
    if (allNetworks.rows.length > 0) {
      console.log('   Networks:', allNetworks.rows.map(r => r.id))
    }
    if (allGroups.rows.length > 0) {
      console.log('   Groups:', allGroups.rows.map(r => `${r.network_id}/${r.group_id}`))
    }
    if (allContacts.rows.length > 0) {
      console.log('   Contacts:', allContacts.rows.map(r => `${r.network_id}/${r.group_id}/${r.contact_id}`))
    }
    
    const networkRows = await client.query('SELECT COUNT(*) FROM bassline_networks WHERE id = $1', [networkId])
    const contactRows = await client.query('SELECT COUNT(*) FROM bassline_contacts WHERE network_id = $1 AND contact_id = $2', [networkId, contactId])
    
    console.log(`   Networks matching our ID: ${networkRows.rows[0].count}`)
    console.log(`   Contacts matching our ID: ${contactRows.rows[0].count}`)
    
    expect(parseInt(networkRows.rows[0].count)).toBe(1)
    expect(parseInt(contactRows.rows[0].count)).toBe(1)
    
    client.release()

    console.log('6. Load contact content...')
    const loadResult = await storage.loadContactContent(networkId, groupId, contactId)
    
    expect(loadResult.ok).toBe(true)
    expect(loadResult.value).toEqual(testContent)
    console.log('   ✓ Contact loaded:', loadResult.value)

    console.log('✅ Direct storage test PASSED')
    
    // Cleanup
    if (storage.close) {
      await storage.close()
    }
    await pool.end()
  })

  it('should handle multiple contacts and groups', async () => {
    console.log('\n=== MULTI-CONTACT STORAGE TEST ===')
    
    const storage = createPostgresStorage({ 
      options: {
        database: 'bassline_test'
      },
      durability: 'performance'
    })

    // Initialize storage
    if (storage.initialize) {
      await storage.initialize()
    }

    const networkId = brand.networkId('multi-test')
    
    // Save network
    await storage.saveNetworkState(networkId, {
      networkId,
      groups: new Map(),
      wires: new Map()
    } as any)

    // Create groups first (required for foreign keys)
    const uniqueGroupIds = ['input', 'output']
    for (const groupIdStr of uniqueGroupIds) {
      const groupId = brand.groupId(groupIdStr)
      const groupState = {
        group: {
          id: groupId,
          name: `${groupIdStr} Group`,
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        },
        contacts: new Map(),
        wires: new Map()
      }
      
      const result = await storage.saveGroupState(networkId, groupId, groupState as any)
      expect(result.ok).toBe(true)
      console.log(`   ✓ Created group ${groupIdStr}`)
    }

    // Save multiple contacts
    const contacts = [
      { groupId: 'input', contactId: 'input-a', content: { value: 10 } },
      { groupId: 'input', contactId: 'input-b', content: { value: 20 } },
      { groupId: 'output', contactId: 'result', content: { sum: 30 } }
    ]

    console.log(`Saving ${contacts.length} contacts...`)
    for (const contact of contacts) {
      const result = await storage.saveContactContent(
        networkId,
        brand.groupId(contact.groupId),
        brand.contactId(contact.contactId),
        contact.content
      )
      expect(result.ok).toBe(true)
      console.log(`   ✓ Saved ${contact.contactId}`)
    }

    // Verify in database
    const client = await pool.connect()
    const contactCount = await client.query('SELECT COUNT(*) FROM bassline_contacts WHERE network_id = $1', [networkId])
    console.log(`Contacts in DB: ${contactCount.rows[0].count}`)
    expect(parseInt(contactCount.rows[0].count)).toBe(contacts.length)
    client.release()

    // Load and verify each contact
    console.log('Loading contacts...')
    for (const contact of contacts) {
      const result = await storage.loadContactContent(
        networkId,
        brand.groupId(contact.groupId), 
        brand.contactId(contact.contactId)
      )
      expect(result.ok).toBe(true)
      expect(result.value).toEqual(contact.content)
      console.log(`   ✓ Loaded ${contact.contactId}:`, result.value)
    }

    console.log('✅ Multi-contact test PASSED')

    // Cleanup
    if (storage.close) {
      await storage.close()
    }
    await pool.end()
  })
})