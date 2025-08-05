/// <reference lib="webworker" />

console.log('[Worker] Network worker starting...')

import { createImmediateScheduler } from '../schedulers/immediate'
import { createBatchScheduler } from '../schedulers/batch'
import { getPrimitiveGadget } from '../primitives'
import { extractToGroup } from '../refactoring/operations/extract-to-group'
import { inlineGroup } from '../refactoring/operations/inline-group'
import { copyContacts } from '../refactoring/operations/copy-contacts'
import { copyGroup } from '../refactoring/operations/copy-group'
import { copySelection } from '../refactoring/operations/copy-selection'
import type { 
  PropagationNetworkScheduler,
  Change,
  Group
} from '../types'

// Worker message types
export interface WorkerRequest {
  id: string
  type: string
  payload: any
}

export interface WorkerResponse {
  id: string
  type: 'success' | 'error'
  data?: any
  error?: string
}

export interface WorkerNotification {
  type: 'changes' | 'ready'
  data: any
}

// Create the scheduler and subscription
let scheduler: PropagationNetworkScheduler = createImmediateScheduler()
let unsubscribe: (() => void) | null = null

// Subscribe to changes and notify main thread
function setupSubscription() {
  if (unsubscribe) {
    unsubscribe()
  }
  
  unsubscribe = scheduler.subscribe((changes: Change[]) => {
    // Clean changes to ensure no functions are sent
    const cleanedChanges = changes.map(change => {
      if (change.type === 'group-added' && change.data && 'primitive' in change.data) {
        // Remove primitive functions from group-added changes
        const cleanedData = { ...change.data }
        if (cleanedData.primitive) {
          cleanedData.primitiveId = cleanedData.primitive.id
          delete cleanedData.primitive
        }
        return { ...change, data: cleanedData }
      }
      return change
    })
    
    const notification: WorkerNotification = {
      type: 'changes',
      data: cleanedChanges
    }
    self.postMessage(notification)
  })
}

// Initial setup
setupSubscription()

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  console.log(`[Worker] Received ${request.type} request:`, request.payload)
  
  const response: WorkerResponse = {
    id: request.id,
    type: 'success',
    data: undefined
  }
  
  try {
    switch (request.type) {
      case 'SET_SCHEDULER': {
        const { strategy, options } = request.payload
        
        // For now, switching schedulers will reset state
        // TODO: Implement proper state migration between schedulers
        
        // Unsubscribe from old scheduler
        if (unsubscribe) {
          unsubscribe()
        }
        
        // Create new scheduler
        switch (strategy) {
          case 'immediate':
            scheduler = createImmediateScheduler()
            break
          case 'batch':
            scheduler = createBatchScheduler(options)
            break
          default:
            throw new Error(`Unknown scheduler strategy: ${strategy}`)
        }
        
        // Resubscribe
        setupSubscription()
        
        // Re-initialize with root group
        await scheduler.registerGroup({
          id: 'root',
          name: 'Root',
          contactIds: [],
          wireIds: [],
          subgroupIds: [],
          boundaryContactIds: []
        })
        
        break
      }
      
      case 'REGISTER_GROUP': {
        const group: Group = request.payload
        
        // If the group has a primitive ID, resolve it to the actual primitive
        if ('primitiveId' in request.payload && request.payload.primitiveId) {
          const primitive = getPrimitiveGadget(request.payload.primitiveId)
          if (primitive) {
            group.primitive = primitive
          }
        }
        
        await scheduler.registerGroup(group)
        break
      }
      
      case 'ADD_GROUP': {
        const { parentId, group } = request.payload
        
        // If the group has a primitive ID, resolve it to the actual primitive
        if ('primitiveId' in group && group.primitiveId) {
          const primitive = getPrimitiveGadget(group.primitiveId)
          if (primitive) {
            group.primitive = primitive
          }
        }
        
        const groupId = await scheduler.addGroup(parentId, group)
        response.data = { groupId }
        break
      }
      
      case 'REMOVE_GROUP': {
        const { groupId } = request.payload
        await scheduler.removeGroup(groupId)
        break
      }
      
      case 'ADD_CONTACT': {
        const { groupId, contact } = request.payload
        console.log(`[Worker] Adding contact to group ${groupId}:`, contact)
        const contactId = await scheduler.addContact(groupId, contact)
        console.log(`[Worker] Contact added with ID:`, contactId)
        response.data = { contactId }
        break
      }
      
      case 'REMOVE_CONTACT': {
        const { contactId } = request.payload
        await scheduler.removeContact(contactId)
        break
      }
      
      case 'UPDATE_CONTENT': {
        const { contactId, content } = request.payload
        await scheduler.scheduleUpdate(contactId, content)
        break
      }
      
      case 'CONNECT': {
        const { fromId, toId, type } = request.payload
        const wireId = await scheduler.connect(fromId, toId, type)
        response.data = { wireId }
        break
      }
      
      case 'DISCONNECT': {
        const { wireId } = request.payload
        await scheduler.disconnect(wireId)
        break
      }
      
      case 'GET_STATE': {
        const { groupId } = request.payload
        const groupState = await scheduler.getState(groupId)
        
        // Remove primitive functions before serialization
        const groupData: any = { ...groupState.group }
        if (groupData.primitive) {
          // Only send the primitive ID, not the functions
          groupData.primitiveId = groupData.primitive.id
          delete groupData.primitive
        }
        
        // Convert Maps to arrays for serialization
        
        response.data = {
          group: groupData,
          contacts: Array.from(groupState.contacts.entries()),
          wires: Array.from(groupState.wires.entries())
        }
        break
      }
      
      case 'GET_CONTACT': {
        const { contactId } = request.payload
        const contact = await scheduler.getContact(contactId)
        response.data = contact
        break
      }
      
      case 'GET_WIRE': {
        const { wireId } = request.payload
        const wire = await scheduler.getWire(wireId)
        response.data = wire
        break
      }
      
      case 'APPLY_REFACTORING': {
        const { operation, params } = request.payload
        console.log(`[Worker] Applying refactoring: ${operation}`, params)
        
        // Check if scheduler supports state import/export
        const exportStateFn = scheduler.exportState?.bind(scheduler)
        const importStateFn = scheduler.importState?.bind(scheduler)
        
        if (!exportStateFn || !importStateFn) {
          throw new Error('Scheduler does not support state import/export')
        }
        
        // Export current state
        const currentState = await exportStateFn()
        
        // Apply the refactoring operation
        let result
        switch (operation) {
          case 'extract-to-group':
            result = extractToGroup(currentState, params)
            break
          case 'inline-group':
            result = inlineGroup(currentState, params)
            break
          case 'copy-contacts':
            result = copyContacts(currentState, params)
            break
          case 'copy-group':
            result = copyGroup(currentState, params)
            break
          case 'copy-selection':
            result = copySelection(currentState, params)
            break
          default:
            throw new Error(`Unknown refactoring operation: ${operation}`)
        }
        
        // Import the new state
        await importStateFn(result.state)
        
        // Return the changes for UI updates
        response.data = {
          success: true,
          changes: result.changes
        }
        break
      }
      
      default:
        throw new Error(`Unknown request type: ${request.type}`)
    }
  } catch (error) {
    console.error(`[Worker] Error handling ${request.type}:`, error)
    response.type = 'error'
    response.error = error instanceof Error ? error.message : String(error)
  }
  
  console.log(`[Worker] Sending response:`, response)
  self.postMessage(response)
}

// Notify main thread that worker is ready
const readyNotification: WorkerNotification = {
  type: 'ready',
  data: null
}
self.postMessage(readyNotification)