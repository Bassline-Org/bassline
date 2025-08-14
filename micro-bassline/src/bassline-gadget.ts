/**
 * The Bassline Gadget
 * 
 * THE meta-propagation gadget that exposes network structure and events.
 * This is the read/write interface to the network itself.
 */

import {
  PrimitiveGadget,
  Bassline,
  PropagationEvent,
  Action,
  ActionSet,
  ContactId,
  GroupId
} from './types'

/**
 * Creates a Bassline Gadget for a specific group.
 * 
 * Outputs:
 * - 'structure': Current bassline snapshot (value contact)
 * - 'events': PropagationEvent stream (stream contact with blendMode: 'last')
 * 
 * Inputs:
 * - 'actions': Action stream to apply (if group allows mutation)
 * 
 * @param getBassline Function to get current bassline structure
 * @param applyActions Function to apply actions (if allowed)
 * @param groupId The group this gadget belongs to
 * @param eventEmitter Function to subscribe to events
 */
export function createBasslineGadget(
  getBassline: () => Bassline,
  applyActions: (actions: ActionSet) => void,
  groupId: GroupId,
  eventEmitter: (listener: (event: PropagationEvent) => void) => () => void,
  isEventsWired: () => boolean = () => false,  // Function to check if events output is wired
  pushEventToStream?: (event: PropagationEvent) => void  // Direct push to stream contact
): PrimitiveGadget {
  const eventListeners = new Set<() => void>()  // Track all listeners to prevent leaks
  let isListening = false
  let hasInitialized = false
  
  return {
    type: 'bassline',
    inputs: ['actions'],
    outputs: ['structure', 'events'],
    
    activation(inputs: Map<string, any>): boolean {
      // Always activate to provide structure output
      // or if we have actions to apply
      return true
    },
    
    execute(inputs: Map<string, any>): Map<string, any> {
      const outputs = new Map<string, any>()
      
      // Always provide current structure
      outputs.set('structure', getBassline())
      
      // Apply actions if provided and allowed
      if (inputs.has('actions')) {
        const bassline = getBassline()
        const group = bassline.groups.get(groupId)
        
        // Check if mutation is allowed
        if (group?.properties?.['allow-mutation'] !== false) {
          const actionSet = inputs.get('actions') as ActionSet
          applyActions(actionSet)
        }
      }
      
      // Initialize event listening on first execution if events are wired
      if (!hasInitialized) {
        hasInitialized = true
        if (isEventsWired()) {
          startEventListening()
        }
      }
      
      // Check if we should start/stop listening based on wiring changes
      if (!isListening && isEventsWired()) {
        startEventListening()
      } else if (isListening && !isEventsWired()) {
        stopEventListening()
      }
      
      // Note: Events are pushed directly to the stream contact via pushEventToStream
      // We don't buffer or return them here
      
      return outputs
    }
  }
  
  function startEventListening() {
    if (isListening) return
    
    isListening = true
    const unsubscribe = eventEmitter((event: PropagationEvent) => {
      // Push event directly to stream contact if available
      if (pushEventToStream) {
        pushEventToStream(event)
      }
    })
    eventListeners.add(unsubscribe)
  }
  
  function stopEventListening() {
    // Clean up all listeners
    for (const unsubscribe of eventListeners) {
      unsubscribe()
    }
    eventListeners.clear()
    isListening = false
  }
}

/**
 * Helper to create a Bassline Gadget that observes the entire network.
 * This is useful for top-level monitoring and debugging.
 */
export function createGlobalBasslineGadget(
  getBassline: () => Bassline,
  applyActions: (actions: ActionSet) => void,
  eventEmitter: (listener: (event: PropagationEvent) => void) => () => void
): PrimitiveGadget {
  return {
    type: 'bassline-global',
    inputs: ['actions'],
    outputs: ['structure', 'events'],
    
    activation(inputs: Map<string, any>): boolean {
      // Always active for global observation
      return true
    },
    
    execute(inputs: Map<string, any>): Map<string, any> {
      const outputs = new Map<string, any>()
      
      // Always provide current structure
      outputs.set('structure', getBassline())
      
      // Apply actions if provided (global gadget always allows mutation)
      if (inputs.has('actions')) {
        const actionSet = inputs.get('actions') as ActionSet
        applyActions(actionSet)
      }
      
      // Events would be handled similarly to the scoped version
      // but without permission checking
      
      return outputs
    }
  }
}

/**
 * Integration with Runtime
 * 
 * The BasslineGadget needs special handling in the runtime:
 * 
 * 1. The 'events' output should be a stream contact (blendMode: 'last')
 * 2. Events should only be emitted if the contact is wired (lazy activation)
 * 3. The 'structure' output is a value contact (blendMode: 'merge')
 * 4. The 'actions' input is a stream contact (blendMode: 'last')
 * 
 * Example usage in a network:
 * 
 * ```typescript
 * // Create a monitoring circuit
 * const monitorGroup = {
 *   id: 'monitor',
 *   primitiveType: 'bassline',
 *   boundaryContactIds: new Set(['monitor-actions', 'monitor-structure', 'monitor-events']),
 *   properties: { 'allow-mutation': false }  // Read-only
 * }
 * 
 * // Wire events to a logger
 * const loggerWire = {
 *   fromId: 'monitor-events',
 *   toId: 'logger-input',
 *   properties: {}  // Events flow one way
 * }
 * 
 * // The logger contact should have blendMode: 'last' to receive all events
 * const loggerInput = {
 *   id: 'logger-input',
 *   properties: { blendMode: 'last' }
 * }
 * ```
 */