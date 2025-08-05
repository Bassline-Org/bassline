import { useState, useEffect, useRef } from 'react'
import { NetworkClient } from '~/propagation-core-v2/worker/network-client'
import type { Change } from '~/propagation-core-v2/types'

export default function WorkerTest() {
  const [changes, setChanges] = useState<Change[]>([])
  const [isReady, setIsReady] = useState(false)
  const [contacts, setContacts] = useState<Record<string, any>>({})
  const [currentScheduler, setCurrentScheduler] = useState<'immediate' | 'batch'>('immediate')
  const [pendingUpdates, setPendingUpdates] = useState(0)
  const [bulkCount, setBulkCount] = useState(10)
  const clientRef = useRef<NetworkClient | null>(null)
  
  useEffect(() => {
    // Create network client
    const client = new NetworkClient({
      onReady: () => {
        setIsReady(true)
      },
      onChanges: (newChanges) => {
        setChanges(prev => [...prev, ...newChanges])
        
        // Update contacts state
        newChanges.forEach(change => {
          if (change.type === 'contact-updated') {
            const update = change.data as any
            setContacts(prev => ({
              ...prev,
              [update.contactId]: update.updates
            }))
          }
        })
      }
    })
    
    clientRef.current = client
    
    // Initialize network
    initializeNetwork(client)
    
    return () => {
      client.terminate()
    }
  }, [])
  
  async function initializeNetwork(client: NetworkClient) {
    try {
      // Create root group
      await client.registerGroup({
        id: 'root',
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
    } catch (error) {
      console.error('Failed to initialize network:', error)
    }
  }
  
  async function createSimpleContacts() {
    const client = clientRef.current
    if (!client) return
    
    try {
      // Create two contacts
      const contact1 = await client.addContact('root', {
        groupId: 'root',
        content: 5,
        blendMode: 'accept-last',
        name: 'A'
      })
      
      const contact2 = await client.addContact('root', {
        groupId: 'root',
        content: 3,
        blendMode: 'accept-last',
        name: 'B'
      })
      
      const result = await client.addContact('root', {
        groupId: 'root',
        blendMode: 'accept-last',
        name: 'Result'
      })
      
      // Store IDs for reference
      setContacts(prev => ({
        ...prev,
        contact1: { id: contact1, name: 'A', content: 5 },
        contact2: { id: contact2, name: 'B', content: 3 },
        result: { id: result, name: 'Result' }
      }))
    } catch (error) {
      console.error('Failed to create contacts:', error)
    }
  }
  
  async function connectContacts() {
    const client = clientRef.current
    if (!client || !contacts.contact1 || !contacts.contact2) return
    
    try {
      // Connect them
      await client.connect(contacts.contact1.id, contacts.contact2.id, 'bidirectional')
    } catch (error) {
      console.error('Failed to connect contacts:', error)
    }
  }
  
  async function createAddGadget() {
    const client = clientRef.current
    if (!client) return
    
    try {
      // Create gadget group with primitive ID
      await client.registerGroup({
        id: 'add-gadget',
        name: 'Add Gadget',
        parentId: 'root',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        primitiveId: 'add' // Send only the ID
      } as any)
      
      // Create boundary contacts
      const inputA = await client.addContact('add-gadget', {
        groupId: 'add-gadget',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input',
        name: 'a'
      })
      
      const inputB = await client.addContact('add-gadget', {
        groupId: 'add-gadget',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input',
        name: 'b'
      })
      
      const outputSum = await client.addContact('add-gadget', {
        groupId: 'add-gadget',
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'output',
        name: 'sum'
      })
      
      setContacts(prev => ({
        ...prev,
        inputA: { id: inputA, name: 'Input A' },
        inputB: { id: inputB, name: 'Input B' },
        outputSum: { id: outputSum, name: 'Output Sum' }
      }))
    } catch (error) {
      console.error('Failed to create gadget:', error)
    }
  }
  
  async function connectToGadget() {
    const client = clientRef.current
    if (!client || !contacts.contact1 || !contacts.inputA) return
    
    try {
      // Connect contact1 (value 5) to input A
      await client.connect(contacts.contact1.id, contacts.inputA.id)
      
      // Connect contact2 (value 3) to input B
      await client.connect(contacts.contact2.id, contacts.inputB.id)
      
      // Connect output to result
      await client.connect(contacts.outputSum.id, contacts.result.id)
    } catch (error) {
      console.error('Failed to connect to gadget:', error)
    }
  }
  
  async function updateValue() {
    const client = clientRef.current
    if (!client || !contacts.contact1) return
    
    try {
      const newValue = Math.floor(Math.random() * 20)
      
      if (currentScheduler === 'batch') {
        setPendingUpdates(prev => prev + 1)
        
        // Set a timer to decrement pending updates after batch processes
        setTimeout(() => {
          setPendingUpdates(prev => Math.max(0, prev - 1))
        }, 5000)
      }
      
      await client.scheduleUpdate(contacts.contact1.id, newValue)
    } catch (error) {
      console.error('Failed to update value:', error)
    }
  }
  
  async function switchScheduler() {
    const client = clientRef.current
    if (!client) return
    
    try {
      const newScheduler = currentScheduler === 'immediate' ? 'batch' : 'immediate'
      
      if (newScheduler === 'batch') {
        await client.setScheduler('batch', { batchSize: 10, batchDelay: 5000 })
      } else {
        await client.setScheduler('immediate')
      }
      
      setCurrentScheduler(newScheduler)
      setPendingUpdates(0) // Reset counter
    } catch (error) {
      console.error('Failed to switch scheduler:', error)
    }
  }
  
  async function bulkUpdate() {
    const client = clientRef.current
    if (!client || !contacts.contact1) return
    
    const startTime = Date.now()
    
    for (let i = 0; i < bulkCount; i++) {
      const newValue = Math.floor(Math.random() * 100)
      
      if (currentScheduler === 'batch') {
        setPendingUpdates(prev => prev + 1)
        // Set a timer to decrement after batch processes
        setTimeout(() => {
          setPendingUpdates(prev => Math.max(0, prev - 1))
        }, 5100) // Slightly after batch delay
      }
      
      await client.scheduleUpdate(contacts.contact1.id, newValue)
    }
    
    const elapsed = Date.now() - startTime
    // Show timing in UI instead of console
    setContacts(prev => ({
      ...prev,
      timing: { lastBulkTime: `${bulkCount} updates queued in ${elapsed}ms` }
    }))
  }
  
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Propagation Network Worker Test</h1>
      
      <div className="mb-6">
        <p className="text-lg mb-2">
          Status: <span className={isReady ? 'text-green-600' : 'text-red-600'}>
            {isReady ? 'Ready' : 'Initializing...'}
          </span>
        </p>
        <p className="text-sm text-gray-600">
          Changes received: {changes.length}
        </p>
        <p className="text-sm text-gray-600">
          Current scheduler: <span className="font-semibold">
            {currentScheduler === 'batch' ? 'Batch (5s delay)' : 'Immediate'}
          </span>
        </p>
        {currentScheduler === 'batch' && pendingUpdates > 0 && (
          <p className="text-sm text-orange-600 font-semibold">
            Pending updates: {pendingUpdates} (processing in ~5 seconds)
          </p>
        )}
      </div>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={createSimpleContacts}
          disabled={!isReady}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          1. Create Simple Contacts (A=5, B=3)
        </button>
        
        <button
          onClick={connectContacts}
          disabled={!isReady || !contacts.contact1}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          2. Connect A ↔ B (Bidirectional)
        </button>
        
        <button
          onClick={createAddGadget}
          disabled={!isReady}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          3. Create Add Gadget
        </button>
        
        <button
          onClick={connectToGadget}
          disabled={!isReady || !contacts.inputA}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          4. Connect Contacts to Gadget
        </button>
        
        <button
          onClick={updateValue}
          disabled={!isReady || !contacts.contact1}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          5. Update Contact A (Random)
        </button>
        
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 px-2 py-2 border rounded"
            min="1"
            max="1000"
          />
          <button
            onClick={bulkUpdate}
            disabled={!isReady || !contacts.contact1}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            6. Bulk Update ({bulkCount} times)
          </button>
        </div>
        
        <button
          onClick={switchScheduler}
          disabled={!isReady}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          title="Warning: This will reset all state"
        >
          Switch to {currentScheduler === 'immediate' ? 'Batch' : 'Immediate'} Scheduler (Resets State)
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-3">Contacts</h2>
          <div className="bg-gray-100 rounded p-4 space-y-2">
            {Object.entries(contacts).map(([key, contact]: [string, any]) => (
              <div key={key} className="bg-white p-2 rounded shadow">
                <span className="font-mono text-sm">{contact.name || key}:</span>
                <span className="ml-2">{JSON.stringify(contact.content ?? 'undefined')}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-3">Recent Changes</h2>
          <div className="bg-gray-100 rounded p-4 h-96 overflow-y-auto">
            {changes.slice(-10).reverse().map((change, i) => (
              <div key={i} className="text-xs mb-2 p-2 bg-white rounded">
                <div className="font-semibold">{change.type}</div>
                <pre className="text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(change.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}