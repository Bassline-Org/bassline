/**
 * Boot Script System for Network Initialization
 * Provides auditable, reproducible network bootstrap with explicit gain allocation
 */

import { createGadget, type Gadget } from './types'
import { createReceipt } from './receipts'
import { createGainMinter } from './gadgets'
import { createSpawner, createEvolver, createIterator } from './spawner'

// ============================================================================
// Types
// ============================================================================

export interface BootScript {
  version: string
  timestamp?: string
  bootstrap: {
    userControl: {
      id: string
      type?: string
      initialGain: number
      authority?: string
    }
    primitives?: {
      source: 'builtin' | string  // 'builtin' or URL for external
      allowed?: string[]
      denied?: string[]
    }
    initialGadgets?: Array<{
      id: string
      type: string
      gain?: number
      parent?: string
      config?: any
    }>
  }
  policy?: {
    gainConservation?: 'strict' | 'relaxed'
    propagationSemantics?: 'argmax-strict' | 'legacy'
    contradictionHandling?: 'signal' | 'throw'
  }
}

export interface Network {
  userControl: Gadget
  gadgets: Map<string, Gadget>
  primitives: Map<string, any>
  bootstrapComplete: boolean
  bootScript: BootScript
  bootReceipt: string
}

// ============================================================================
// Boot System
// ============================================================================

/**
 * Load a boot script from JSON
 */
export async function loadBootScript(scriptOrPath: string | BootScript): Promise<BootScript> {
  if (typeof scriptOrPath === 'object') {
    return scriptOrPath
  }
  
  // In a real implementation, this would load from file system or network
  // For now, parse as JSON string
  try {
    return JSON.parse(scriptOrPath)
  } catch (e) {
    throw new Error(`Failed to parse boot script: ${e}`)
  }
}

/**
 * Boot a network from a script
 */
export async function bootNetwork(script: BootScript): Promise<Network> {
  // Validate script version
  if (script.version !== '1.0') {
    throw new Error(`Unsupported boot script version: ${script.version}`)
  }
  
  const network: Network = {
    userControl: null as any,
    gadgets: new Map(),
    primitives: new Map(),
    bootstrapComplete: false,
    bootScript: script,
    bootReceipt: ''
  }
  
  // 1. Create boot receipt
  const bootTime = script.timestamp || new Date().toISOString()
  createReceipt('system', 0, `Network boot at ${bootTime} from script v${script.version}`)
  network.bootReceipt = `boot-${bootTime}`
  
  // 2. Create user control socket with initial gain
  const userControl = createGadget(script.bootstrap.userControl.id)
  userControl.gainPool = script.bootstrap.userControl.initialGain
  createReceipt(
    userControl.id, 
    userControl.gainPool, 
    `Bootstrap allocation - authority: ${script.bootstrap.userControl.authority || 'root'}`
  )
  network.userControl = userControl
  network.gadgets.set(userControl.id, userControl)
  
  // 3. Load primitives (for now, just track configuration)
  if (script.bootstrap.primitives) {
    const primConfig = script.bootstrap.primitives
    createReceipt('system', 0, `Primitives loaded from ${primConfig.source}`)
    
    if (primConfig.allowed) {
      for (const prim of primConfig.allowed) {
        network.primitives.set(prim, true)
      }
    }
  }
  
  // 4. Create initial gadgets
  if (script.bootstrap.initialGadgets) {
    for (const spec of script.bootstrap.initialGadgets) {
      const gadget = createGadgetFromSpec(spec)
      
      // Transfer gain from userControl if specified
      if (spec.gain && spec.gain > 0) {
        if (userControl.gainPool >= spec.gain) {
          gadget.gainPool = spec.gain
          userControl.gainPool -= spec.gain
          createReceipt(
            gadget.id,
            spec.gain,
            `Initial allocation from ${userControl.id}`
          )
        } else {
          throw new Error(`Insufficient gain for gadget ${spec.id}: requested ${spec.gain}, available ${userControl.gainPool}`)
        }
      }
      
      network.gadgets.set(gadget.id, gadget)
      
      // Set parent if specified
      if (spec.parent) {
        const parent = network.gadgets.get(spec.parent)
        if (parent) {
          parent.gadgets.set(gadget.id, gadget)
          gadget.parent = new WeakRef(parent)
        }
      }
    }
  }
  
  // 5. Apply policy settings (stored for reference)
  if (script.policy) {
    createReceipt('system', 0, `Policy: ${JSON.stringify(script.policy)}`)
  }
  
  // 6. Lock down - no more bootstrap operations
  network.bootstrapComplete = true
  createReceipt('system', 0, 'Bootstrap complete - runtime mode active')
  
  return network
}

/**
 * Create a gadget from a boot spec
 */
function createGadgetFromSpec(spec: any): Gadget {
  switch (spec.type) {
    case 'gainMinter':
      return createGainMinter(spec.id)
    case 'spawner':
      return createSpawner(spec.id)
    case 'evolver':
      return createEvolver(spec.id)
    case 'iterator':
      return createIterator(spec.id)
    default:
      // Default to basic gadget
      return createGadget(spec.id)
  }
}

/**
 * Create a minimal boot script for testing
 */
export function createTestBootScript(initialGain: number = 10000): BootScript {
  return {
    version: '1.0',
    bootstrap: {
      userControl: {
        id: 'test-user',
        initialGain: initialGain
      }
    }
  }
}