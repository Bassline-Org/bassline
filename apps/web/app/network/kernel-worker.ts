/**
 * Kernel Worker
 * 
 * Runs a full kernel instance in a Web Worker for local mode
 * Communicates with main thread via PostMessage
 */

import { 
  Kernel, 
  UserspaceRuntime, 
  MemoryStorageDriver,
  brand,
  type ExternalInput 
} from '@bassline/core'

// Worker message types matching BrowserWorkerBridgeDriver
interface WorkerMessage {
  type: 'init' | 'shutdown' | 'operation' | 'health' | 'command' | 'change'
  data?: any
  requestId?: string
}

// Create kernel instance
const kernel = new Kernel({ debug: true })
const runtime = new UserspaceRuntime({ kernel })

// Add memory storage driver
const storage = new MemoryStorageDriver()

// Track initialization
let initialized = false

// Initialize kernel
async function initialize() {
  if (initialized) return
  
  try {
    // Register storage driver
    await kernel.registerDriver(storage)
    
    // Create root group
    try {
      await runtime.registerGroup({
        id: brand.groupId('root'),
        name: 'Root Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      console.log('[KernelWorker] Root group created')
    } catch (e) {
      console.log('[KernelWorker] Root group already exists')
    }
    
    initialized = true
    
    // Notify main thread we're ready
    self.postMessage({
      type: 'ready'
    } as WorkerMessage)
    
    console.log('[KernelWorker] Kernel initialized')
  } catch (error) {
    console.error('[KernelWorker] Initialization failed:', error)
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Initialization failed'
    } as WorkerMessage)
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data
  
  switch (message.type) {
    case 'init':
      await initialize()
      break
      
    case 'shutdown':
      try {
        await kernel.shutdown()
        self.postMessage({
          type: 'response',
          requestId: message.requestId,
          data: { success: true }
        } as WorkerMessage)
      } catch (error) {
        self.postMessage({
          type: 'error',
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'Shutdown failed'
        } as WorkerMessage)
      }
      break
      
    case 'operation':
      // Handle ExternalInput operations
      if (!initialized) {
        await initialize()
      }
      
      try {
        const input = message.data as ExternalInput
        let result: any = null
        
        // Process the operation through the runtime
        switch (input.type) {
          case 'external-add-contact':
            const contactId = await runtime.addContact(input.groupId, {
              content: input.contact.content,
              blendMode: input.contact.blendMode
            })
            result = { id: contactId, contactId }
            break
            
          case 'external-contact-update':
            await runtime.scheduleUpdate(input.contactId, input.value)
            result = { success: true }
            break
            
          case 'external-add-group':
            const groupId = brand.groupId(`group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`)
            await runtime.registerGroup({
              id: groupId,
              name: input.group.name,
              contactIds: [],
              wireIds: [],
              subgroupIds: [],
              boundaryContactIds: []
            })
            
            if (input.parentGroupId) {
              // TODO: Add to parent's subgroups
            }
            
            result = { id: groupId, groupId }
            break
            
          case 'external-create-wire':
            // TODO: Implement wire creation
            result = { id: 'wire-todo' }
            break
            
          case 'external-query-group':
            const state = await runtime.getState(input.groupId)
            result = {
              type: 'query-result',
              requestId: input.requestId,
              groupId: input.groupId,
              group: state.group,
              contacts: input.includeContacts ? 
                Array.from(state.contacts.entries()).map(([id, contact]) => ({
                  id,
                  content: contact.content,
                  blendMode: contact.blendMode
                })) : undefined,
              wires: input.includeWires ?
                Array.from(state.wires.entries()).map(([id, wire]) => ({
                  id,
                  fromId: wire.fromId,
                  toId: wire.toId,
                  type: wire.type
                })) : undefined
            }
            break
            
          case 'external-query-contact':
            // TODO: Implement contact query
            result = { content: null }
            break
            
          default:
            throw new Error(`Unknown operation type: ${(input as any).type}`)
        }
        
        // Send response
        self.postMessage({
          type: 'response',
          requestId: message.requestId,
          data: result
        } as WorkerMessage)
        
      } catch (error) {
        console.error('[KernelWorker] Operation failed:', error)
        self.postMessage({
          type: 'error',
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'Operation failed'
        } as WorkerMessage)
      }
      break
      
    case 'health':
      // Respond to health check
      self.postMessage({
        type: 'response',
        requestId: message.requestId,
        data: true
      } as WorkerMessage)
      break
      
    case 'command':
      // Handle driver commands
      // For now, just return success
      self.postMessage({
        type: 'response',
        requestId: message.requestId,
        data: { status: 'success' }
      } as WorkerMessage)
      break
      
    default:
      console.warn('[KernelWorker] Unknown message type:', message.type)
  }
}

// Set up change listener
// When the runtime emits changes, forward them to main thread
runtime.subscribe((changes) => {
  changes.forEach(change => {
    self.postMessage({
      type: 'change',
      data: change
    } as WorkerMessage)
  })
})

// Auto-initialize on load
initialize().catch(error => {
  console.error('[KernelWorker] Auto-initialization failed:', error)
})

// Export for TypeScript
export {}