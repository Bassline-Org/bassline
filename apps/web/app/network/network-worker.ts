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
  type Change,
  type NetworkRequest,
  type NetworkResponse,
  type NetworkNotification,
  type Result,
  type NetworkError,
  brand
} from '@bassline/core'

// Re-export types from core for backwards compatibility
export type { NetworkRequest as WorkerRequest, NetworkResponse as WorkerResponse, NetworkNotification as WorkerNotification }

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
        id: brand.groupId(gadget.id),
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
  self.postMessage({ type: 'ready' } as NetworkNotification)
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
      } as NetworkNotification)
    }
    changeTimer = null
  }, 10) as unknown as number
}

// Handle incoming requests
async function handleRequest(request: NetworkRequest): Promise<NetworkResponse> {
  if (!scheduler) {
    return {
      id: request.id,
      result: {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Scheduler not initialized'
        }
      }
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
          request.data.wireType
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
        
      case 'applyRefactoring':
        // Handle refactoring operations
        if ('applyRefactoring' in scheduler && typeof scheduler.applyRefactoring === 'function') {
          result = await scheduler.applyRefactoring(request.data.operation, request.data.params)
        } else {
          throw new Error('Refactoring not supported by current scheduler')
        }
        break
        
      case 'setScheduler':
        // Switch scheduler type
        const oldScheduler = scheduler
        const schedulerType = request.data.scheduler
        
        // Export state from old scheduler
        let state = null
        if (oldScheduler && 'exportState' in oldScheduler && typeof oldScheduler.exportState === 'function') {
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
        if (state && scheduler && 'importState' in scheduler && typeof scheduler.importState === 'function') {
          await scheduler.importState(state)
        }
        
        // Re-register all primitive gadgets
        for (const gadget of allPrimitiveGadgets) {
          try {
            await scheduler.registerGroup({
              id: brand.groupId(gadget.id),
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
        
        // Re-subscribe to changes
        scheduler.subscribe((changes) => {
          pendingChanges.push(...changes)
          scheduleChangeNotification()
        })
        
        result = undefined
        break

      case 'listPrimitives':
        // Return primitive IDs synchronously from allPrimitiveGadgets
        result = allPrimitiveGadgets.map(gadget => gadget.id)
        break

      case 'listPrimitiveInfo':
        // Return primitive info synchronously from allPrimitiveGadgets
        result = allPrimitiveGadgets.map(gadget => ({
          qualifiedName: gadget.id,
          id: gadget.id,
          name: gadget.name,
          inputs: gadget.inputs,
          outputs: gadget.outputs,
          category: gadget.category,
          description: gadget.description,
          isPure: gadget.isPure
        }))
        break

      case 'getPrimitiveInfo':
        // Find specific primitive info synchronously
        const targetGadget = allPrimitiveGadgets.find(g => g.id === request.data.qualifiedName)
        if (targetGadget) {
          result = {
            qualifiedName: targetGadget.id,
            id: targetGadget.id,
            name: targetGadget.name,
            inputs: targetGadget.inputs,
            outputs: targetGadget.outputs,
            category: targetGadget.category,
            description: targetGadget.description,
            isPure: targetGadget.isPure
          }
        } else {
          throw new Error(`Primitive not found: ${request.data.qualifiedName}`)
        }
        break

      case 'listSchedulers':
        // Return available scheduler types
        result = ['immediate', 'batch', 'animation-frame', 'priority']
        break

      case 'getSchedulerInfo':
        // Return info for specific scheduler
        const schedulerId = request.data.schedulerId
        const schedulerInfo = {
          id: schedulerId,
          name: schedulerId.charAt(0).toUpperCase() + schedulerId.slice(1) + ' Scheduler',
          description: `${schedulerId} execution scheduler`
        }
        
        switch (schedulerId) {
          case 'immediate':
            schedulerInfo.description = 'Executes propagation immediately on each change'
            break
          case 'batch':
            schedulerInfo.description = 'Batches changes and executes in chunks'
            break
          case 'animation-frame':
            schedulerInfo.description = 'Executes propagation on animation frames'
            break
          case 'priority':
            schedulerInfo.description = 'Priority-based execution scheduler'
            break
        }
        
        result = schedulerInfo
        break
        
      default:
        throw new Error(`Unknown request type: ${request.type}`)
    }
    
    return {
      id: request.id,
      result: {
        ok: true,
        value: result
      }
    }
  } catch (error) {
    return {
      id: request.id,
      result: {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

// Helper function to send external input to kernel
async function sendExternalInput(input: any): Promise<void> {
  // This is a placeholder - in a real implementation, this would send the input
  // to the kernel via the userspace runtime. For now, we'll just log it.
  console.log('[NetworkWorker] Would send external input to kernel:', input)
}

// Listen for messages from main thread
self.onmessage = async (event: MessageEvent<NetworkRequest>) => {
  const response = await handleRequest(event.data)
  self.postMessage(response)
}

// Initialize the worker
initialize().catch((error) => {
  console.error('[Worker] Failed to initialize:', error)
  self.postMessage({ 
    type: 'error', 
    error: {
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error)
    }
  } as NetworkNotification)
})