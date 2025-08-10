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
  CompoundDriver,
  HistoryDriver,
  brand,
  type ExternalInput,
  type CommandResponse 
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

// Create compound driver with sub-drivers
const compoundDriver = new CompoundDriver('main-compound')

// Add memory storage driver
const storage = new MemoryStorageDriver()
compoundDriver.setStorageDriver(storage)

// Add history driver for undo/redo
const historyDriver = new HistoryDriver('main-history', {
  maxHistorySize: 100,
  captureInterval: 100
})

// Set up input handler to route ExternalInput through runtime
historyDriver.setInputHandler(async (input) => {
  console.log('[KernelWorker] HistoryDriver emitting ExternalInput:', input)
  await runtime.receiveExternalInput(input)
})

compoundDriver.setHistoryDriver(historyDriver)

// Track initialization
let initialized = false

// Initialize kernel
async function initialize() {
  if (initialized) return
  
  try {
    // Initialize system drivers (primitive loader, scheduler driver)
    await kernel.initializeSystemDrivers()
    
    // Connect runtime to kernel for new modular system
    kernel.setUserspaceRuntime(runtime)
    
    // Register compound driver (which includes storage)
    await kernel.registerDriver(compoundDriver.asDriver())
    
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
            // Store the current value before updating for history tracking
            const currentState = await runtime.getState(input.groupId)
            if (currentState) {
              const contact = currentState.contacts.get(input.contactId)
              if (contact && historyDriver) {
                historyDriver.storePreviousValue(input.contactId, contact.content)
              }
            }
            
            await runtime.scheduleUpdate(input.contactId, input.value)
            result = { success: true }
            break
            
          case 'external-add-group':
            // The runtime will handle this through receiveExternalInput
            // But we need to get the group ID for the response
            const groupId = brand.groupId(`group-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`)
            
            // Check if this is a primitive gadget
            let primitive = undefined
            if (input.group.primitiveId) {
              const { getPrimitiveGadget } = await import('@bassline/core')
              primitive = getPrimitiveGadget(input.group.primitiveId)
              if (!primitive) {
                throw new Error(`Unknown primitive gadget: ${input.group.primitiveId}`)
              }
            }
            
            await runtime.registerGroup({
              id: groupId,
              name: input.group.name,
              contactIds: [],
              wireIds: [],
              subgroupIds: [],
              boundaryContactIds: [],
              primitive
            })
            
            // Add to parent if specified
            if (input.parentGroupId) {
              const parentState = await runtime.getState(input.parentGroupId)
              if (parentState) {
                parentState.group.subgroupIds.push(groupId)
              }
            }
            
            result = { id: groupId, groupId }
            break
            
          case 'external-create-wire':
            const wireId = await runtime.connect(
              input.fromContactId, 
              input.toContactId, 
              'bidirectional'
            )
            result = { id: wireId, wireId }
            break
            
          case 'external-remove-wire':
            await runtime.removeWire(input.wireId)
            result = { success: true }
            break
            
          case 'external-remove-contact':
            await runtime.removeContact(input.contactId)
            result = { success: true }
            break
            
          case 'external-remove-group':
            await runtime.removeGroup(input.groupId)
            result = { success: true }
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
                  blendMode: contact.blendMode,
                  isBoundary: contact.isBoundary,
                  boundaryDirection: contact.boundaryDirection,
                  name: contact.name,
                  groupId: contact.groupId
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
            
          case 'external-load-primitive':
            // Load primitive module through kernel
            const primitiveLoader = kernel.getPrimitiveLoader()
            if (!primitiveLoader) {
              throw new Error('Primitive loader not initialized')
            }
            await primitiveLoader.loadModule(input.moduleSource)
            result = { success: true }
            break
            
          case 'external-create-primitive-gadget':
            // Create primitive gadget through runtime
            console.log(`[KernelWorker] Creating primitive gadget:`, {
              qualifiedName: input.qualifiedName,
              parentGroupId: input.parentGroupId
            })
            const gadgetId = await runtime.createPrimitiveGadget(
              input.qualifiedName,
              input.parentGroupId
            )
            console.log(`[KernelWorker] Primitive gadget created:`, gadgetId)
            
            // Debug: Check the created gadget state
            const createdState = await runtime.getState(gadgetId)
            console.log(`[KernelWorker] Created gadget state:`, {
              groupId: gadgetId,
              boundaryContactIds: createdState.group.boundaryContactIds,
              totalContacts: createdState.contacts.size,
              boundaryContacts: Array.from(createdState.contacts.values()).filter(c => c.isBoundary)
            })
            
            result = { id: gadgetId, groupId: gadgetId }
            break
            
          case 'external-list-primitives':
            // List available primitives
            const loader = kernel.getPrimitiveLoader()
            if (!loader) {
              throw new Error('Primitive loader not initialized')
            }
            result = { 
              primitives: loader.listPrimitives(),
              requestId: input.requestId
            }
            break
            
          case 'external-set-scheduler':
            // Set active scheduler
            const schedulerDriver = kernel.getSchedulerDriver()
            if (!schedulerDriver) {
              throw new Error('Scheduler driver not initialized')
            }
            schedulerDriver.activateScheduler(input.schedulerId, input.config)
            result = { success: true }
            break
            
          case 'external-list-primitive-info':
            // List detailed primitive information
            const infoLoader = kernel.getPrimitiveLoader()
            if (!infoLoader) {
              throw new Error('Primitive loader not initialized')
            }
            result = { 
              primitiveInfo: infoLoader.listPrimitiveInfo(),
              requestId: input.requestId
            }
            break
            
          case 'external-get-primitive-info':
            // Get specific primitive information
            const getInfoLoader = kernel.getPrimitiveLoader()
            if (!getInfoLoader) {
              throw new Error('Primitive loader not initialized')
            }
            const primitiveInfo = getInfoLoader.getPrimitiveInfo(input.qualifiedName)
            if (!primitiveInfo) {
              throw new Error(`Primitive not found: ${input.qualifiedName}`)
            }
            result = { 
              primitiveInfo,
              requestId: input.requestId
            }
            break
            
          case 'external-list-schedulers':
            // List available schedulers
            const listSchedulerDriver = kernel.getSchedulerDriver()
            if (!listSchedulerDriver) {
              throw new Error('Scheduler driver not initialized')
            }
            result = { 
              schedulers: listSchedulerDriver.listSchedulers(),
              requestId: input.requestId
            }
            break
            
          case 'external-get-scheduler-info':
            // Get specific scheduler information
            const getSchedulerDriver = kernel.getSchedulerDriver()
            if (!getSchedulerDriver) {
              throw new Error('Scheduler driver not initialized')
            }
            const schedulerInfo = getSchedulerDriver.getSchedulerInfo(input.schedulerId)
            if (!schedulerInfo) {
              throw new Error(`Scheduler not found: ${input.schedulerId}`)
            }
            result = { 
              schedulerInfo,
              requestId: input.requestId
            }
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
      // Handle driver commands (undo/redo, etc)
      if (!initialized) {
        await initialize()
      }
      
      try {
        const command = message.data
        let result: CommandResponse
        
        // Route commands through compound driver
        if (command.type === 'undo' || command.type === 'redo') {
          result = await compoundDriver.handleCommand(command)
        } else {
          // Other commands can be handled directly
          result = { status: 'success' }
        }
        
        self.postMessage({
          type: 'response',
          requestId: message.requestId,
          data: result
        } as WorkerMessage)
      } catch (error) {
        self.postMessage({
          type: 'error',
          requestId: message.requestId,
          error: error instanceof Error ? error.message : 'Command failed'
        } as WorkerMessage)
      }
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