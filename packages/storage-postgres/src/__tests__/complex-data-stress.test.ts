import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NormalizedPostgresStorage } from '../normalized-storage'
import { brand } from '@bassline/core'
import type { NetworkId, GroupId, ContactId, GroupState, WireId } from '@bassline/core'

// Generate realistic data structures
function generateUserProfile(id: number) {
  return {
    id: `user-${id}`,
    username: `user_${id}`,
    email: `user${id}@example.com`,
    profile: {
      firstName: `First${id}`,
      lastName: `Last${id}`,
      avatar: `https://avatars.example.com/${id}.jpg`,
      bio: `This is a bio for user ${id}. It contains some text that might be typical in a real application.`,
      joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      settings: {
        theme: id % 2 === 0 ? 'dark' : 'light',
        notifications: {
          email: true,
          push: id % 3 === 0,
          sms: id % 5 === 0
        },
        privacy: {
          profileVisible: true,
          showEmail: false,
          showActivity: id % 2 === 1
        }
      }
    },
    stats: {
      posts: Math.floor(Math.random() * 1000),
      followers: Math.floor(Math.random() * 10000),
      following: Math.floor(Math.random() * 500),
      likes: Math.floor(Math.random() * 5000)
    },
    metadata: {
      lastLogin: new Date(),
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      sessionId: `session-${id}-${Date.now()}`
    }
  }
}

function generateSensorData(id: number) {
  return {
    sensorId: `sensor-${id}`,
    timestamp: Date.now(),
    readings: {
      temperature: 20 + Math.random() * 10,
      humidity: 40 + Math.random() * 40,
      pressure: 1000 + Math.random() * 50,
      co2: 400 + Math.random() * 200,
      light: Math.random() * 10000,
      motion: Math.random() > 0.5
    },
    location: {
      building: `Building-${Math.floor(id / 100)}`,
      floor: Math.floor((id % 100) / 20),
      room: `Room-${id % 20}`,
      coordinates: {
        lat: 37.7749 + Math.random() * 0.1,
        lng: -122.4194 + Math.random() * 0.1,
        altitude: Math.random() * 100
      }
    },
    status: {
      online: true,
      battery: Math.random() * 100,
      signalStrength: -30 - Math.random() * 70,
      firmware: `v2.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 100)}`,
      lastMaintenance: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
    }
  }
}

function generateFinancialTransaction(id: number) {
  return {
    transactionId: `tx-${id}-${Date.now()}`,
    type: ['payment', 'transfer', 'withdrawal', 'deposit'][id % 4],
    amount: {
      value: Math.random() * 10000,
      currency: ['USD', 'EUR', 'GBP', 'JPY'][id % 4],
      exchangeRate: 1 + Math.random() * 0.1
    },
    parties: {
      sender: {
        accountId: `acc-${Math.floor(Math.random() * 1000)}`,
        name: `Sender ${id}`,
        bank: `Bank ${id % 10}`,
        country: ['US', 'UK', 'DE', 'JP'][id % 4]
      },
      recipient: {
        accountId: `acc-${Math.floor(Math.random() * 1000)}`,
        name: `Recipient ${id}`,
        bank: `Bank ${(id + 1) % 10}`,
        country: ['US', 'UK', 'DE', 'JP'][(id + 1) % 4]
      }
    },
    metadata: {
      timestamp: new Date(),
      reference: `REF-${id}-${Date.now()}`,
      category: ['utilities', 'groceries', 'entertainment', 'travel'][id % 4],
      tags: [`tag${id % 5}`, `category${id % 3}`, `priority${id % 2}`],
      notes: `Transaction note for ${id}`,
      audit: {
        createdBy: `system-${id % 10}`,
        approvedBy: id % 3 === 0 ? `manager-${id % 5}` : null,
        riskScore: Math.random(),
        fraudCheck: {
          passed: Math.random() > 0.1,
          score: Math.random(),
          flags: []
        }
      }
    }
  }
}

describe('Complex Data Stress Test', () => {
  let storage: NormalizedPostgresStorage
  let networkId: NetworkId
  
  beforeAll(async () => {
    storage = new NormalizedPostgresStorage({
      options: {
        database: 'bassline_test',
        poolSize: 50,
      },
      limits: {
        maxContactsPerGroup: 10000,
        maxGroupsPerNetwork: 1000,
        maxContentSizeBytes: 500 * 1024 // 500KB for larger objects
      }
    })
    
    const initResult = await storage.initialize()
    if (!initResult.ok) {
      throw new Error(`Failed to initialize storage: ${initResult.error.message}`)
    }
    
    networkId = brand.networkId('complex-data-test')
    
    const networkState = {
      groups: new Map(),
      rootGroup: brand.groupId('root')
    }
    await storage.saveNetworkState(networkId, networkState)
  })
  
  afterAll(async () => {
    if (process.env.CLEAN_TEST_DB === 'true') {
      await storage.deleteNetwork(networkId)
    }
    await storage.close()
  })

  describe('User Profile Data', () => {
    it('should handle 10,000 user profiles efficiently', async () => {
      const groupId = brand.groupId('user-profiles')
      const contacts = new Map()
      
      console.time('Generate 10k user profiles')
      for (let i = 0; i < 10000; i++) {
        contacts.set(brand.contactId(`user-${i}`), {
          content: generateUserProfile(i)
        })
      }
      console.timeEnd('Generate 10k user profiles')
      
      console.time('Save 10k user profiles')
      const saveResult = await storage.saveGroupState(networkId, groupId, {
        contacts,
        wires: new Map(),
        boundaryContacts: { input: new Map(), output: new Map() }
      })
      console.timeEnd('Save 10k user profiles')
      
      expect(saveResult.ok).toBe(true)
      
      console.time('Load 10k user profiles')
      const loadResult = await storage.loadGroupState(networkId, groupId)
      console.timeEnd('Load 10k user profiles')
      
      if (loadResult.ok && loadResult.value) {
        expect(loadResult.value.contacts.size).toBe(10000)
        
        // Verify data integrity
        const sampleUser = loadResult.value.contacts.get('user-0')
        if (sampleUser?.content) {
          const content = sampleUser.content as any
          expect(content.username).toBe('user_0')
          expect(content.profile.firstName).toBe('First0')
          expect(content.stats).toBeDefined()
        }
      }
    }, 60000)

    it('should handle complex queries on user data', async () => {
      // Create groups with specific attributes for querying
      const categories = ['premium', 'standard', 'trial']
      
      for (const category of categories) {
        const groupId = brand.groupId(`users-${category}`)
        const contacts = new Map()
        
        for (let i = 0; i < 100; i++) {
          contacts.set(brand.contactId(`${category}-user-${i}`), {
            content: generateUserProfile(i)
          })
        }
        
        const groupState: any = {
          contacts,
          wires: new Map(),
          boundaryContacts: { input: new Map(), output: new Map() },
          attributes: {
            type: 'user-group',
            category: category,
            size: '100',
            created: new Date().toISOString()
          }
        }
        
        await storage.saveGroupState(networkId, groupId, groupState)
      }
      
      console.time('Query user groups by type')
      const queryResult = await storage.queryGroups(networkId, { type: 'user-group' })
      console.timeEnd('Query user groups by type')
      
      if (queryResult.ok) {
        expect(queryResult.value.length).toBeGreaterThanOrEqual(3)
      }
    })
  })

  describe('IoT Sensor Data', () => {
    it('should handle high-frequency sensor data updates', async () => {
      const sensorGroups = 10
      const sensorsPerGroup = 100
      const updatesPerSensor = 50
      
      console.log(`\nSimulating ${sensorGroups * sensorsPerGroup} sensors with ${updatesPerSensor} updates each`)
      
      // Create sensor groups
      const groupIds: GroupId[] = []
      for (let g = 0; g < sensorGroups; g++) {
        const groupId = brand.groupId(`sensor-group-${g}`)
        groupIds.push(groupId)
        
        const contacts = new Map()
        for (let s = 0; s < sensorsPerGroup; s++) {
          const sensorId = g * sensorsPerGroup + s
          contacts.set(brand.contactId(`sensor-${sensorId}`), {
            content: generateSensorData(sensorId)
          })
        }
        
        await storage.saveGroupState(networkId, groupId, {
          contacts,
          wires: new Map(),
          boundaryContacts: { input: new Map(), output: new Map() }
        })
      }
      
      // Simulate rapid sensor updates
      console.time(`${updatesPerSensor * sensorsPerGroup} sensor updates`)
      
      const updatePromises = []
      for (let u = 0; u < updatesPerSensor; u++) {
        for (let g = 0; g < Math.min(3, sensorGroups); g++) { // Update first 3 groups
          const groupId = groupIds[g]
          
          for (let s = 0; s < sensorsPerGroup; s++) {
            const sensorId = g * sensorsPerGroup + s
            updatePromises.push(
              storage.saveContactContent(
                networkId,
                groupId,
                brand.contactId(`sensor-${sensorId}`),
                generateSensorData(sensorId)
              )
            )
          }
        }
      }
      
      await Promise.all(updatePromises)
      console.timeEnd(`${updatesPerSensor * sensorsPerGroup} sensor updates`)
      
      // Verify final state
      const finalGroup = await storage.loadGroupState(networkId, groupIds[0])
      if (finalGroup.ok && finalGroup.value) {
        expect(finalGroup.value.contacts.size).toBe(sensorsPerGroup)
      }
    }, 120000)
  })

  describe('Financial Transaction Network', () => {
    it('should handle complex transaction graphs with relationships', async () => {
      const accountGroups = 5
      const transactionsPerGroup = 500
      
      console.log(`\nCreating financial network with ${accountGroups} accounts and ${transactionsPerGroup} transactions each`)
      
      const accountGroupIds: GroupId[] = []
      
      // Create account groups with transactions
      for (let a = 0; a < accountGroups; a++) {
        const groupId = brand.groupId(`account-${a}`)
        accountGroupIds.push(groupId)
        
        const contacts = new Map()
        const wires = new Map()
        
        // Add transactions as contacts
        for (let t = 0; t < transactionsPerGroup; t++) {
          const contactId = brand.contactId(`tx-${a}-${t}`)
          contacts.set(contactId, {
            content: generateFinancialTransaction(a * transactionsPerGroup + t)
          })
          
          // Create wires to represent transaction relationships
          if (t > 0) {
            const wireId = brand.wireId(`wire-${a}-${t}`) as WireId
            wires.set(wireId, {
              from: {
                groupId: groupId,
                contactId: brand.contactId(`tx-${a}-${t-1}`)
              },
              to: {
                groupId: groupId,
                contactId: contactId
              },
              type: 'sequential'
            })
          }
          
          // Add cross-account wires for transfers
          if (a > 0 && t % 10 === 0) {
            const targetGroup = accountGroupIds[a - 1]
            const wireId = brand.wireId(`cross-${a}-${t}`) as WireId
            wires.set(wireId, {
              from: {
                groupId: groupId,
                contactId: contactId
              },
              to: {
                groupId: targetGroup,
                contactId: brand.contactId(`tx-${a-1}-${Math.min(t, transactionsPerGroup-1)}`)
              },
              type: 'transfer'
            })
          }
        }
        
        // Add boundary contacts for account interfaces
        const boundaryContacts = {
          input: new Map([
            ['deposits', brand.contactId('tx-0-0')],
            ['transfers_in', brand.contactId(`tx-${a}-1`)]
          ]),
          output: new Map([
            ['withdrawals', brand.contactId(`tx-${a}-${transactionsPerGroup-1}`)],
            ['transfers_out', brand.contactId(`tx-${a}-${transactionsPerGroup-2}`)]
          ])
        }
        
        console.time(`Save account ${a} with ${transactionsPerGroup} transactions`)
        await storage.saveGroupState(networkId, groupId, {
          contacts,
          wires,
          boundaryContacts
        })
        console.timeEnd(`Save account ${a} with ${transactionsPerGroup} transactions`)
      }
      
      // Test loading with relationships
      console.time('Load account with full transaction graph')
      const accountWithGraph = await storage.loadGroupState(networkId, accountGroupIds[accountGroups - 1])
      console.timeEnd('Load account with full transaction graph')
      
      if (accountWithGraph.ok && accountWithGraph.value) {
        expect(accountWithGraph.value.contacts.size).toBe(transactionsPerGroup)
        expect(accountWithGraph.value.wires.size).toBeGreaterThan(0)
        expect(accountWithGraph.value.boundaryContacts.input.size).toBe(2)
        expect(accountWithGraph.value.boundaryContacts.output.size).toBe(2)
      }
    }, 120000)
  })

  describe('Mixed Workload Performance', () => {
    it('should handle mixed read/write operations on complex data', async () => {
      const operations = []
      
      console.log('\nRunning mixed workload with complex data types')
      
      // Mix of operations
      for (let i = 0; i < 100; i++) {
        // 30% writes of user profiles
        if (i % 10 < 3) {
          operations.push(
            storage.saveContactContent(
              networkId,
              brand.groupId('mixed-users'),
              brand.contactId(`mixed-user-${i}`),
              generateUserProfile(i)
            )
          )
        }
        
        // 30% writes of sensor data
        if (i % 10 >= 3 && i % 10 < 6) {
          operations.push(
            storage.saveContactContent(
              networkId,
              brand.groupId('mixed-sensors'),
              brand.contactId(`mixed-sensor-${i}`),
              generateSensorData(i)
            )
          )
        }
        
        // 20% writes of transactions
        if (i % 10 >= 6 && i % 10 < 8) {
          operations.push(
            storage.saveContactContent(
              networkId,
              brand.groupId('mixed-transactions'),
              brand.contactId(`mixed-tx-${i}`),
              generateFinancialTransaction(i)
            )
          )
        }
        
        // 20% reads
        if (i % 10 >= 8) {
          operations.push(
            storage.loadContactContent(
              networkId,
              brand.groupId('mixed-users'),
              brand.contactId(`mixed-user-${Math.floor(Math.random() * i)}`)
            )
          )
        }
      }
      
      console.time('100 mixed operations on complex data')
      const results = await Promise.all(operations)
      console.timeEnd('100 mixed operations on complex data')
      
      const failures = results.filter(r => !r.ok)
      console.log(`Success rate: ${((results.length - failures.length) / results.length * 100).toFixed(1)}%`)
      
      // Most should succeed (some reads might fail if contact doesn't exist)
      expect(failures.length).toBeLessThan(results.length * 0.3)
    })
  })

  describe('Data Size Analysis', () => {
    it('should analyze storage efficiency for different data types', async () => {
      console.log('\n=== Storage Efficiency Analysis ===\n')
      
      const testCases = [
        { name: 'Simple number', data: { value: 42 } },
        { name: 'Simple string', data: { text: 'Hello, World!' } },
        { name: 'Small object', data: { id: 1, name: 'Test', active: true } },
        { name: 'User profile', data: generateUserProfile(1) },
        { name: 'Sensor data', data: generateSensorData(1) },
        { name: 'Transaction', data: generateFinancialTransaction(1) },
        { name: 'Large array', data: { items: Array(100).fill(0).map((_, i) => ({ id: i, value: Math.random() })) } },
        { name: 'Nested object', data: {
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: {
                    data: 'Deep nesting test',
                    values: [1, 2, 3, 4, 5]
                  }
                }
              }
            }
          }
        }}
      ]
      
      for (const testCase of testCases) {
        const groupId = brand.groupId(`size-test-${testCase.name.replace(/\s+/g, '-')}`)
        const contactId = brand.contactId('test-contact')
        
        const jsonSize = Buffer.byteLength(JSON.stringify(testCase.data))
        
        const saveStart = performance.now()
        await storage.saveContactContent(networkId, groupId, contactId, testCase.data)
        const saveTime = performance.now() - saveStart
        
        const loadStart = performance.now()
        const result = await storage.loadContactContent(networkId, groupId, contactId)
        const loadTime = performance.now() - loadStart
        
        console.log(`${testCase.name}:`)
        console.log(`  JSON size: ${jsonSize} bytes`)
        console.log(`  Save time: ${saveTime.toFixed(2)}ms`)
        console.log(`  Load time: ${loadTime.toFixed(2)}ms`)
        console.log(`  Efficiency: ${(saveTime / jsonSize * 1000).toFixed(3)}ms per KB`)
        console.log()
      }
    })
  })
})