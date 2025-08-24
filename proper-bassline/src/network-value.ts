/**
 * NetworkValue - Networks as first-class values in the propagation system
 * 
 * This allows networks to be stored in cells, passed through propagation,
 * and queried even when they're values rather than direct references.
 */

import { LatticeValue } from './types'
import type { Network } from './network'
import type { GadgetBase } from './gadget-base'

export class NetworkValue implements LatticeValue {
  readonly type = 'network' as const
  readonly value: Network
  
  constructor(network: Network) {
    this.value = network
  }
  
  /**
   * Query the network even when it's stored as a value
   * This is key - networks remain queryable even when passed through cells
   */
  query(selector: string): Set<GadgetBase> {
    return this.value.query(selector)
  }
  
  /**
   * Add a gadget to the network
   */
  add(...gadgets: GadgetBase[]): void {
    this.value.add(...gadgets)
  }
  
  /**
   * Remove a gadget from the network
   */
  remove(gadget: GadgetBase): boolean {
    return this.value.remove(gadget)
  }
  
  /**
   * Get a gadget by path
   */
  getByPath(path: string): GadgetBase | null {
    return this.value.getByPath(path)
  }
  
  /**
   * Connect two gadgets in the network
   */
  connect(from: GadgetBase | string, to: GadgetBase | string): void {
    const fromGadget = typeof from === 'string' ? this.getByPath(from) : from
    const toGadget = typeof to === 'string' ? this.getByPath(to) : to
    
    if (fromGadget && toGadget) {
      fromGadget.addDownstream(toGadget)
      toGadget.addUpstream(fromGadget)
    }
  }
  
  /**
   * Disconnect two gadgets
   */
  disconnect(from: GadgetBase | string, to: GadgetBase | string): void {
    const fromGadget = typeof from === 'string' ? this.getByPath(from) : from
    const toGadget = typeof to === 'string' ? this.getByPath(to) : to
    
    if (fromGadget && toGadget) {
      fromGadget.removeDownstream(toGadget)
      toGadget.removeUpstream(fromGadget)
    }
  }
  
  /**
   * Get all gadgets in the network
   */
  getAllGadgets(): Set<GadgetBase> {
    return this.value.gadgets
  }
  
  /**
   * Check if this network contains a gadget
   */
  contains(gadget: GadgetBase | string): boolean {
    if (typeof gadget === 'string') {
      return this.getByPath(gadget) !== null
    }
    return this.value.gadgets.has(gadget)
  }
  
  /**
   * Get the size of the network
   */
  get size(): number {
    return this.value.gadgets.size
  }
  
  /**
   * Serialize the network value
   */
  serialize(): any {
    return {
      type: 'network',
      network: this.value.serialize()
    }
  }
  
  /**
   * Create a NetworkValue from serialized data
   */
  static deserialize(data: any, registry: any): NetworkValue {
    // This will need the registry to deserialize the network
    const network = registry.deserializeNetwork(data.network)
    return new NetworkValue(network)
  }
  
  /**
   * String representation for debugging
   */
  toString(): string {
    return `NetworkValue(${this.value.id}, ${this.size} gadgets)`
  }
}

/**
 * Type guard for NetworkValue
 */
export function isNetworkValue(value: any): value is NetworkValue {
  return value && value.type === 'network' && value.value
}

/**
 * Helper to extract a Network from a LatticeValue if it's a NetworkValue
 */
export function getNetwork(value: LatticeValue | null): Network | null {
  if (!value) return null
  if (isNetworkValue(value)) {
    return value.value
  }
  return null
}

/**
 * Create a NetworkValue from a Network
 */
export function networkValue(network: Network): NetworkValue {
  return new NetworkValue(network)
}