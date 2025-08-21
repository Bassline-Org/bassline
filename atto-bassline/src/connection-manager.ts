/**
 * Connection Manager Gadget
 * A gadget that manages dynamic wiring between other gadgets
 */

import { primitive, type Template, type PrimitiveTemplate } from './templates-v2'
import { wire, unwire, type Gadget, type Contact, signal } from './types'
import { propagate } from './propagation'

// Connection type definition
export interface Connection {
  id: string
  from: { gadgetId: string; contactName: string }
  to: { gadgetId: string; contactName: string }
  created: number
  strength: number
}

// Connection manager state
interface ConnectionManagerState {
  connections: Map<string, Connection>
  pendingSource: { gadgetId: string; contactName: string } | null
  lastConnectionId: number
}

// Global state for the connection manager (since compute is pure)
const managerStates = new Map<string, ConnectionManagerState>()

function getOrCreateState(gadgetId: string): ConnectionManagerState {
  if (!managerStates.has(gadgetId)) {
    managerStates.set(gadgetId, {
      connections: new Map(),
      pendingSource: null,
      lastConnectionId: 0
    })
  }
  return managerStates.get(gadgetId)!
}

/**
 * Connection Manager Template
 * Manages dynamic connections between gadgets in the network
 */
export const ConnectionManagerTemplate: PrimitiveTemplate = primitive(
  {
    inputs: {
      connectionMode: { type: 'boolean', default: false },
      sourceGadgetId: { type: 'string', default: '' },
      sourceContactName: { type: 'string', default: '' },
      targetGadgetId: { type: 'string', default: '' },
      targetContactName: { type: 'string', default: '' },
      createConnection: { type: 'boolean', default: false },
      deleteConnectionId: { type: 'string', default: '' },
      clearPending: { type: 'boolean', default: false }
    },
    outputs: {
      activeConnections: { type: 'array' },
      pendingConnection: { type: 'object' },
      connectionStatus: { type: 'string' },
      lastError: { type: 'string' },
      connectionCount: { type: 'number' }
    }
  },
  (inputs) => {
    // Get state for this instance
    const state = getOrCreateState('connection-manager')
    
    console.log('ConnectionManager compute called with inputs:', inputs)
    
    let error = ''
    let status = 'idle'
    
    // Handle clearing pending connection
    if (inputs.clearPending) {
      state.pendingSource = null
    }
    
    // Handle starting a connection (setting source)
    if (inputs.connectionMode && inputs.sourceGadgetId && inputs.sourceContactName) {
      if (!state.pendingSource || 
          state.pendingSource.gadgetId !== inputs.sourceGadgetId ||
          state.pendingSource.contactName !== inputs.sourceContactName) {
        state.pendingSource = {
          gadgetId: inputs.sourceGadgetId,
          contactName: inputs.sourceContactName
        }
        status = 'selecting-target'
      }
    }
    
    // Handle completing a connection (setting target)
    if (state.pendingSource && inputs.targetGadgetId && inputs.targetContactName && inputs.createConnection) {
      // Don't allow self-connections to the same contact
      if (state.pendingSource.gadgetId === inputs.targetGadgetId && 
          state.pendingSource.contactName === inputs.targetContactName) {
        error = 'Cannot connect a contact to itself'
      } else {
        // Create the connection
        const connectionId = `conn-${++state.lastConnectionId}`
        const connection: Connection = {
          id: connectionId,
          from: { ...state.pendingSource },
          to: {
            gadgetId: inputs.targetGadgetId,
            contactName: inputs.targetContactName
          },
          created: Date.now(),
          strength: 5000 // 0.5 in decimal
        }
        
        state.connections.set(connectionId, connection)
        state.pendingSource = null
        status = 'connected'
        
        // Note: Actual wiring happens outside the compute function
        // since we need access to the gadget instances
      }
    }
    
    // Handle deleting a connection
    if (inputs.deleteConnectionId && state.connections.has(inputs.deleteConnectionId)) {
      state.connections.delete(inputs.deleteConnectionId)
      // Note: Actual unwiring happens outside the compute function
    }
    
    // Update status based on current state
    if (!inputs.connectionMode) {
      status = 'idle'
      state.pendingSource = null
    } else if (state.pendingSource) {
      status = 'selecting-target'
    } else if (inputs.connectionMode) {
      status = 'selecting-source'
    }
    
    return {
      activeConnections: Array.from(state.connections.values()),
      pendingConnection: state.pendingSource,
      connectionStatus: status,
      lastError: error,
      connectionCount: state.connections.size
    }
  },
  'Connection manager for dynamic gadget wiring'
)

/**
 * Convert values between different types for cross-type connections
 */
function convertValue(value: any, fromType: string, toType: string): any {
  if (fromType === toType) return value
  
  // Handle null/undefined
  if (value === null || value === undefined) {
    return toType === 'string' ? '' : 
           toType === 'number' ? 0 : 
           toType === 'boolean' ? false : value
  }
  
  // Convert to string
  if (toType === 'string') {
    if (typeof value === 'object' && value.tag === 'contradiction') {
      return 'CONFLICT'
    }
    return String(value)
  }
  
  // Convert to number
  if (toType === 'number') {
    if (typeof value === 'boolean') return value ? 1 : 0
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return Number(value) || 0
  }
  
  // Convert to boolean
  if (toType === 'boolean') {
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') return value !== '' && value !== 'false'
    return Boolean(value)
  }
  
  return value
}

/**
 * Infer type from contact name or template
 */
function inferContactType(gadget: Gadget, contactName: string): string {
  // Simple heuristics based on contact names
  if (contactName === 'value' || contactName === 'min' || contactName === 'max' || contactName === 'step') {
    return 'number'
  }
  if (contactName === 'text' || contactName === 'placeholder') {
    return 'string'
  }
  if (contactName === 'checked' || contactName === 'enabled' || contactName === 'isDragging') {
    return 'boolean'
  }
  
  // Check the actual value type as fallback
  const contact = gadget.contacts.get(contactName)
  if (contact) {
    const value = contact.signal.value
    if (typeof value === 'number') return 'number'
    if (typeof value === 'string') return 'string'
    if (typeof value === 'boolean') return 'boolean'
  }
  
  return 'any'
}

/**
 * Helper function to actually create wires between gadgets
 * This needs to be called from React where we have access to gadget instances
 */
export function applyConnection(
  connection: Connection,
  gadgetRegistry: Map<string, Gadget>
): boolean {
  const fromGadget = gadgetRegistry.get(connection.from.gadgetId)
  const toGadget = gadgetRegistry.get(connection.to.gadgetId)
  
  if (!fromGadget || !toGadget) {
    console.error('Gadgets not found for connection', connection)
    return false
  }
  
  const fromContact = fromGadget.contacts.get(connection.from.contactName)
  const toContact = toGadget.contacts.get(connection.to.contactName)
  
  if (!fromContact || !toContact) {
    console.error('Contacts not found for connection', connection)
    return false
  }
  
  // Infer types for conversion
  const fromType = inferContactType(fromGadget, connection.from.contactName)
  const toType = inferContactType(toGadget, connection.to.contactName)
  
  // If types are different, create a converter gadget to handle the conversion
  if (fromType !== toType && toType !== 'any') {
    // Create a converter gadget that sits between the two contacts
    const converterId = `converter-${connection.id}`
    const converter = {
      id: converterId,
      contacts: new Map(),
      gadgets: new Map(),
      gainPool: 0,
      compute: (inputs: Map<string, any>) => {
        const inputSignal = inputs.get('input')
        if (inputSignal) {
          const converted = convertValue(inputSignal.value, fromType, toType)
          return new Map([['output', { value: converted, strength: inputSignal.strength }]])
        }
        return new Map()
      },
      primitive: true
    }
    
    // Create input and output contacts for converter
    const inputContact = {
      id: 'input',
      direction: 'input' as const,
      boundary: false,
      signal: { value: null, strength: 0 },
      gadget: new WeakRef(converter),
      sources: new Set(),
      targets: new Set()
    }
    
    const outputContact = {
      id: 'output', 
      direction: 'output' as const,
      boundary: false,
      signal: { value: null, strength: 0 },
      gadget: new WeakRef(converter),
      sources: new Set(),
      targets: new Set()
    }
    
    converter.contacts.set('input', inputContact)
    converter.contacts.set('output', outputContact)
    
    // Store converter in registry
    gadgetRegistry.set(converterId, converter)
    
    // Wire: fromContact -> converter.input -> converter.output -> toContact
    wire(fromContact, inputContact)
    wire(outputContact, toContact)
    
    // Propagate initial value through converter
    const initialConverted = convertValue(fromContact.signal.value, fromType, toType)
    propagate(toContact, signal(initialConverted, connection.strength / 10000))
  } else {
    // Types match or target accepts any - direct wire
    wire(fromContact, toContact)
    
    // Propagate current value from source to target
    propagate(toContact, signal(fromContact.signal.value, connection.strength / 10000))
  }
  
  return true
}

/**
 * Helper function to remove wires between gadgets
 */
export function removeConnection(
  connection: Connection,
  gadgetRegistry: Map<string, Gadget>
): boolean {
  const fromGadget = gadgetRegistry.get(connection.from.gadgetId)
  const toGadget = gadgetRegistry.get(connection.to.gadgetId)
  
  if (!fromGadget || !toGadget) {
    return false
  }
  
  const fromContact = fromGadget.contacts.get(connection.from.contactName)
  const toContact = toGadget.contacts.get(connection.to.contactName)
  
  if (!fromContact || !toContact) {
    return false
  }
  
  // Check if there's a converter gadget for this connection
  const converterId = `converter-${connection.id}`
  const converter = gadgetRegistry.get(converterId)
  
  if (converter) {
    // Remove converter wires
    const converterInput = converter.contacts.get('input')
    const converterOutput = converter.contacts.get('output')
    
    if (converterInput && converterOutput) {
      unwire(fromContact, converterInput)
      unwire(converterOutput, toContact)
    }
    
    // Remove converter from registry
    gadgetRegistry.delete(converterId)
  } else {
    // Direct connection - remove the direct wire
    unwire(fromContact, toContact)
  }
  
  return true
}