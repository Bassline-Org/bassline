/**
 * Network Worker - Runs the propagation network in a Web Worker
 */

import { 
  createImmediateScheduler, 
  createBatchScheduler,
  createAnimationFrameScheduler,
  createPriorityScheduler,
  allPrimitiveGadgets,
  type PropagationNetworkScheduler,
  type Change
} from '@bassline/core'

// Worker request/response types
export interface WorkerRequest {
  id: string
  type: string
  data?: any
}

export interface WorkerResponse {
  id: string
  type: 'success' | 'error'
  data?: any
  error?: string
}

export interface WorkerNotification {
  type: 'changes' | 'ready'
  changes?: Change[]
}

// Current scheduler instance
let scheduler: PropagationNetworkScheduler | null = null
let pendingChanges: Change[] = []
let changeTimer: number | null = null

// Initialize with immediate scheduler by default
async function initialize() {
  scheduler = createImmediateScheduler()
  
  // Register all primitive gadgets as groups
  for (const gadget of allPrimitiveGadgets) {
    try {
      await scheduler.registerGroup({
        id: gadget.id as any,
        name: gadget.name,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        primitive: gadget
      })
    } catch (error) {
      console.warn(`Failed to register primitive gadget ${gadget.id}:`, error)
    }
  }
  
  // Subscribe to changes
  scheduler.subscribe((changes) => {
    pendingChanges.push(...changes)
    scheduleChangeNotification()
  })
  
  // Notify that worker is ready
  self.postMessage({ type: 'ready' } as WorkerNotification)
}

// Batch change notifications for performance
function scheduleChangeNotification() {
  if (changeTimer !== null) return
  
  changeTimer = self.setTimeout(() => {
    if (pendingChanges.length > 0) {
      const changes = [...pendingChanges]
      pendingChanges = []
      self.postMessage({ 
        type: 'changes', 
        changes 
      } as WorkerNotification)
    }
    changeTimer = null
  }, 10) as unknown as number
}

// Handle incoming requests
async function handleRequest(request: WorkerRequest): Promise<WorkerResponse> {
  if (!scheduler) {
    return {
      id: request.id,
      type: 'error',
      error: 'Scheduler not initialized'
    }
  }
  
  try {
    let result: any
    
    switch (request.type) {
      case 'registerGroup':
        await scheduler.registerGroup(request.data)
        result = undefined
        break
        
      case 'scheduleUpdate':
        await scheduler.scheduleUpdate(
          request.data.contactId,
          request.data.content
        )
        result = undefined
        break
        
      case 'schedulePropagation':
        await scheduler.schedulePropagation(
          request.data.fromContactId,
          request.data.toContactId,
          request.data.content
        )
        result = undefined
        break
        
      case 'connect':
        result = await scheduler.connect(
          request.data.fromId,
          request.data.toId,
          request.data.type
        )
        break
        
      case 'disconnect':
        await scheduler.disconnect(request.data.wireId)
        result = undefined
        break
        
      case 'addContact':
        result = await scheduler.addContact(
          request.data.groupId,
          request.data.contact
        )
        break
        
      case 'removeContact':
        await scheduler.removeContact(request.data.contactId)
        result = undefined
        break
        
      case 'addGroup':
        result = await scheduler.addGroup(
          request.data.parentGroupId,
          request.data.group
        )
        break
        
      case 'removeGroup':
        await scheduler.removeGroup(request.data.groupId)
        result = undefined
        break
        
      case 'getState':
        result = await scheduler.getState(request.data.groupId)
        break
        
      case 'getContact':
        result = await scheduler.getContact(request.data.contactId)
        break
        
      case 'getWire':
        result = await scheduler.getWire(request.data.wireId)
        break
        
      case 'setScheduler':
        // Switch scheduler type
        const oldScheduler = scheduler
        const schedulerType = request.data.scheduler
        
        // Export state from old scheduler
        let state = null
        if (oldScheduler && 'exportState' in oldScheduler) {
          state = await oldScheduler.exportState()
        }
        
        // Create new scheduler
        switch (schedulerType) {
          case 'immediate':
            scheduler = createImmediateScheduler()
            break
          case 'batch':
            scheduler = createBatchScheduler()
            break
          case 'animation-frame':
            scheduler = createAnimationFrameScheduler()
            break
          case 'priority':
            scheduler = createPriorityScheduler()
            break
          default:
            throw new Error(`Unknown scheduler type: ${schedulerType}`)
        }
        
        // Import state to new scheduler
        if (state && scheduler && 'importState' in scheduler) {
          await scheduler.importState(state)
        }
        
        // Re-subscribe to changes
        scheduler.subscribe((changes) => {
          pendingChanges.push(...changes)
          scheduleChangeNotification()
        })
        
        result = undefined
        break
        
      default:
        throw new Error(`Unknown request type: ${request.type}`)
    }
    
    return {
      id: request.id,
      type: 'success',
      data: result
    }
  } catch (error) {
    return {
      id: request.id,
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// Listen for messages from main thread
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const response = await handleRequest(event.data)
  self.postMessage(response)
}

// Initialize the worker
initialize().catch((error) => {
  console.error('[Worker] Failed to initialize:', error)
  self.postMessage({ 
    type: 'error', 
    error: error instanceof Error ? error.message : String(error) 
  })
})