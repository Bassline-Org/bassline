/**
 * Bassline Gadget - Exposes a group's bassline for introspection and modification
 * 
 * This gadget is THE fundamental meta-gadget. It exposes the current group's
 * bassline (reified network structure) as contacts that can be observed and modified.
 */

import type { PrimitiveGadget } from '../types'
import type { 
  Bassline, 
  ActionSet,
  ReifiedAction
} from '../bassline-types'
import { hasCapability } from '../bassline-types'

/**
 * Create a Bassline Gadget primitive
 * 
 * This is a special primitive that provides meta-level access to the network.
 * It's scoped to the group it's instantiated in.
 * 
 * Inputs:
 * - merge: ActionSet to apply to the bassline (if capabilities allow)
 * - refresh: Trigger to re-read the bassline
 * 
 * Outputs:
 * - bassline: The current bassline as data
 * - appliedActions: Stream of applied actions
 * - groupId: This group's ID
 * - parentId: Parent group's ID (if any)
 * - capabilities: Current capabilities
 */
export function createBasslineGadget(
  getBassline: () => Bassline,
  applyActions?: (actions: ActionSet) => Promise<void>,
  groupId?: string,
  parentId?: string
): PrimitiveGadget {
  // Track last applied actions for output
  let lastAppliedActions: ActionSet | null = null
  
  return {
    id: 'bassline',
    name: 'Bassline',
    
    // Define inputs based on capabilities
    inputs: getBasslineInputs(getBassline()),
    
    // Always provide these outputs
    outputs: [
      'bassline',
      'appliedActions', 
      'groupId',
      'parentId',
      'capabilities'
    ],
    
    // Activate when merge input changes or refresh is triggered
    activation: (inputs: Map<string, unknown>) => {
      const bassline = getBassline()
      
      // If we have modify capability, activate on merge input
      if (hasCapability(bassline, 'bassline.modify') && inputs.has('merge')) {
        const merge = inputs.get('merge')
        return merge != null && merge !== undefined
      }
      
      // Always activate on refresh
      if (inputs.has('refresh')) {
        return inputs.get('refresh') === true
      }
      
      // Also activate if we have no inputs (initial read)
      return inputs.size === 0
    },
    
    // The computation
    body: async (inputs: Map<string, unknown>) => {
      const bassline = getBassline()
      const outputs = new Map<string, unknown>()
      
      // Handle merge input if present and capable
      if (hasCapability(bassline, 'bassline.modify') && inputs.has('merge')) {
        const actionSet = inputs.get('merge') as ActionSet
        
        if (actionSet && applyActions) {
          // Apply the actions
          await applyActions(actionSet)
          lastAppliedActions = actionSet
          
          // Get updated bassline after applying actions
          const updatedBassline = getBassline()
          outputs.set('bassline', updatedBassline)
          outputs.set('appliedActions', actionSet)
        }
      } else {
        // Just output current bassline
        outputs.set('bassline', bassline)
        outputs.set('appliedActions', lastAppliedActions)
      }
      
      // Always output these
      outputs.set('groupId', groupId || bassline.groups.keys().next().value || 'unknown')
      outputs.set('parentId', parentId || null)
      outputs.set('capabilities', Array.from(bassline.capabilities))
      
      return outputs
    },
    
    description: 'Exposes the bassline (reified network structure) of the current group',
    category: 'custom',
    isPure: false  // Has side effects when applying actions
  }
}

/**
 * Determine inputs based on capabilities
 */
function getBasslineInputs(bassline: Bassline): string[] {
  const inputs: string[] = ['refresh']  // Always have refresh
  
  if (hasCapability(bassline, 'bassline.modify')) {
    inputs.push('merge')  // Add merge input if can modify
  }
  
  return inputs
}

/**
 * Create a read-only Bassline Gadget (no modification)
 */
export function createReadOnlyBasslineGadget(
  getBassline: () => Bassline,
  groupId?: string,
  parentId?: string
): PrimitiveGadget {
  return {
    id: 'bassline-readonly',
    name: 'Bassline (Read-Only)',
    
    inputs: ['refresh'],
    outputs: ['bassline', 'groupId', 'parentId', 'capabilities'],
    
    activation: () => true,  // Always active
    
    body: async () => {
      const bassline = getBassline()
      
      return new Map<string, unknown>([
        ['bassline', bassline],
        ['groupId', groupId || bassline.groups.keys().next().value || 'unknown'],
        ['parentId', parentId || null],
        ['capabilities', Array.from(bassline.capabilities)]
      ])
    },
    
    description: 'Read-only access to the bassline of the current group',
    category: 'custom',
    isPure: true  // No side effects
  }
}

/**
 * Helper to create individual action gadgets
 * These are smaller gadgets for specific actions
 */
export function createAddContactGadget(): PrimitiveGadget {
  return {
    id: 'add-contact',
    name: 'Add Contact',
    
    inputs: ['contactData'],
    outputs: ['action'],
    
    activation: (inputs) => inputs.has('contactData'),
    
    body: async (inputs) => {
      const contactData = inputs.get('contactData')
      
      if (!contactData) {
        return new Map()
      }
      
      const action: ReifiedAction = ['addContact', contactData as any]
      const actionSet: ActionSet = {
        actions: [action],
        timestamp: Date.now(),
        source: 'add-contact-gadget'
      }
      
      return new Map([['action', actionSet]])
    },
    
    description: 'Creates an action to add a contact',
    category: 'custom',
    isPure: true
  }
}

/**
 * Check if a group should have a Bassline Gadget
 * (Based on capabilities)
 */
export function shouldHaveBasslineGadget(bassline: Bassline): boolean {
  return hasCapability(bassline, 'bassline.observe') ||
         hasCapability(bassline, 'bassline.modify')
}