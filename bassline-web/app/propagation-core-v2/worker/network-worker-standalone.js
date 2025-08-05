// Standalone worker wrapper for Node.js
import { parentPort } from 'worker_threads'

// Import the core propagation logic
import { ImmediateScheduler } from '../schedulers/immediate.js'
import { BatchScheduler } from '../schedulers/batch.js'

let scheduler = null
let isInitialized = false

// Message handler
parentPort.on('message', async (message) => {
  const { id, type, ...data } = message
  
  try {
    let response = null
    
    switch (type) {
      case 'INIT':
        if (data.scheduler === 'batch') {
          scheduler = new BatchScheduler()
        } else {
          scheduler = new ImmediateScheduler()
        }
        isInitialized = true
        response = { success: true }
        break
        
      case 'REGISTER_GROUP':
        if (!isInitialized) throw new Error('Worker not initialized')
        scheduler.registerGroup(data.group)
        response = { success: true }
        break
        
      case 'ADD_CONTACT':
        if (!isInitialized) throw new Error('Worker not initialized')
        const contactId = await scheduler.addContact(data.groupId, data.contact)
        response = { contactId }
        break
        
      case 'CONNECT':
        if (!isInitialized) throw new Error('Worker not initialized')
        const wireId = await scheduler.connect(data.fromId, data.toId, data.type)
        response = { wireId }
        break
        
      case 'SCHEDULE_UPDATE':
        if (!isInitialized) throw new Error('Worker not initialized')
        await scheduler.scheduleUpdate(data.contactId, data.content)
        response = { success: true }
        break
        
      case 'GET_STATE':
        if (!isInitialized) throw new Error('Worker not initialized')
        const state = scheduler.getState(data.groupId)
        response = state
        break
        
      case 'EXPORT_STATE':
        if (!isInitialized) throw new Error('Worker not initialized')
        const exportedState = scheduler.exportState(data.groupId)
        response = exportedState
        break
        
      case 'IMPORT_STATE':
        if (!isInitialized) throw new Error('Worker not initialized')
        scheduler.importState(data.state)
        response = { success: true }
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
    
    // Send response
    parentPort.postMessage({
      id,
      type: 'success',
      data: response
    })
    
  } catch (error) {
    parentPort.postMessage({
      id,
      type: 'error',
      error: error.message
    })
  }
})

// Set up change notifications
setInterval(() => {
  if (scheduler && scheduler.getChanges) {
    const changes = scheduler.getChanges()
    if (changes && changes.length > 0) {
      parentPort.postMessage({
        type: 'notification',
        notification: 'changes',
        changes
      })
    }
  }
}, 100)