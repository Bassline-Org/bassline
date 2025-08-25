/**
 * Network - A Cell that contains gadgets and wires
 * 
 * Networks are themselves semi-lattices that only grow (union operation).
 * Multiple networks can be merged together.
 * 
 * Networks implement the Container interface, making them queryable.
 * This is a key distinction: Networks can be searched, Cells/Functions cannot.
 */

import { Cell } from './cell'
import { Gadget } from './gadget'
import { LatticeValue, str } from './types'
import { OrdinalCell } from './cells/basic'
import type { GadgetBase, Container } from './gadget-base'
import { Query, query } from './query'
import { NetworkValue } from './network-value'

export class Network extends Cell implements Container {
  gadgets: Set<Gadget> = new Set()  // Strong references to prevent GC (includes child networks!)
  children: Set<GadgetBase> = new Set()  // All child gadgets for Container interface
  declare parent?: GadgetBase  // Parent gadget if nested
  
  // For Container interface - we'll keep the Map for named lookups
  private childNetworks: Map<string, Network> = new Map()  // Child networks by name for namespacing
  
  constructor(id: string = "network") {
    super(id)
  }
  
  // Network's lattice operation is UNION - networks only grow!
  latticeOp(): LatticeValue {
    // Networks merge by combining their gadgets
    // For simplicity, we'll return a summary
    return str(`network-${this.id}[${this.gadgets.size} gadgets]`)
  }
  
  // Add a gadget to the network (holds strong reference)
  addGadget(gadget: Gadget): void {
    this.gadgets.add(gadget)
    this.children.add(gadget)  // Also add to children for Container interface
  }
  
  // Add multiple gadgets at once (implements Container.add)
  add(...gadgets: GadgetBase[]): this {
    for (const gadget of gadgets) {
      if (gadget instanceof Gadget) {
        this.addGadget(gadget)
      } else {
        // For non-Gadget GadgetBase, just add to children
        this.children.add(gadget)
      }
    }
    return this
  }
  
  // Remove a gadget (implements Container.remove)
  remove(gadget: GadgetBase): boolean {
    if (gadget instanceof Gadget) {
      this.gadgets.delete(gadget)
    }
    return this.children.delete(gadget)
  }
  
  // Helper to connect gadgets (no more wires!)
  connect(source: Gadget, target: Gadget, options?: {
    sourceOutput?: string,
    targetInput?: string  // For functions
  }): void {
    const outputName = options?.sourceOutput ?? "default"
    
    // Handle connection based on target type
    if ('connectFrom' in target && !options?.targetInput) {
      // Target is a Cell - can have many inputs
      (target as any).connectFrom(source, outputName)
    } else if ('connectFrom' in target && options?.targetInput) {
      // Target is a Function - needs specific input name
      (target as any).connectFrom(options.targetInput, source, outputName)
    } else {
      throw new Error("Target must be a Cell or Function with connectFrom method")
    }
  }
  
  // Override compute for compatibility
  compute(): void {
    // With new propagation protocol, we don't need centralized propagation
    // Just update our output summary
    this.setOutput("default", str(`network[${this.gadgets.size} gadgets]`), false)  // Don't auto-emit to avoid loops
  }
  
  // Start propagation by computing all gadgets once
  // The new protocol handles propagation automatically
  propagate(): void {
    // Just compute each gadget once to kick off propagation
    // The accept/emit protocol will handle the rest
    for (const gadget of this.gadgets) {
      if (gadget === (this as Gadget)) continue  // Skip ourselves
      gadget.compute()
    }
  }
  
  // Merge another network into this one (true UNION - flattens everything)
  mergeNetwork(other: Network): void {
    // Union of all gadgets (strong refs maintained)
    for (const gadget of other.gadgets) {
      this.gadgets.add(gadget)
    }
  }
  
  // Add a child network (explicit nesting for namespacing)
  addChildNetwork(child: Network): void {
    // Networks are gadgets, so add it
    this.gadgets.add(child)
    this.children.add(child as GadgetBase);
    // Also track in childNetworks map for easy lookup
    this.childNetworks.set(child.id, child);
    (child as any).parent = new WeakRef(this as any)
  }
  
  // ============================================================================
  // Query Implementation (Container interface)
  // ============================================================================
  
  /**
   * Query this network for gadgets matching a selector
   * This is what makes Networks special - they can be searched
   * 
   * @example
   * network.query("Cell")              // All cells
   * network.query("#myId")             // Gadget with id "myId"
   * network.query("Cell[value>5]")     // Cells with value > 5
   * network.query("Network > Cell")    // Direct child cells
   */
  query(selector: string): Set<GadgetBase> {
    return new Query(this as unknown as Container).select(selector).execute()
  }
  
  /**
   * Convert this network to a NetworkValue so it can be passed as a value
   */
  asValue(): NetworkValue {
    return new NetworkValue(this)
  }
  
  // Get a gadget by path (e.g., "auth/user" or just "user")
  getByPath(path: string): Gadget | null {
    const parts = path.split('/')
    
    if (parts.length === 1) {
      // Local lookup
      for (const gadget of this.gadgets) {
        if (gadget.id === parts[0]) return gadget
      }
      return null
    }
    
    // Nested lookup
    const [networkName, ...rest] = parts
    const child = this.childNetworks.get(networkName)
    if (!child) return null
    
    return child.getByPath(rest.join('/'))
  }
  
  // Get full path of this network
  getFullPath(): string {
    const parts: string[] = [this.id]
    let currentRef = this.parent
    
    while (currentRef) {
      const current = (currentRef as any).deref()
      if (!current) break  // Parent was garbage collected
      parts.unshift(current.id)
      currentRef = current.parent
    }
    
    return parts.join('/')
  }
  
  // Get all boundary cells in this network
  getBoundaries(): Cell[] {
    const boundaries: Cell[] = []
    for (const gadget of this.gadgets) {
      // Import Cell type to check instanceof
      if ('isBoundary' in gadget && (gadget as any).isBoundary()) {
        boundaries.push(gadget as any)
      }
    }
    return boundaries
  }
  
  // Helper to create and mark a boundary cell
  addBoundary(cell: Cell): void {
    cell.makeBoundary()
    this.addGadget(cell)
  }
  
  // Helper for importing: create local cell wired to external
  import(localName: string, externalGadget: Gadget): Cell {
    // Import is just creating a local cell wired to external
    // Using OrdinalCell for now, could be configurable
    const local = new OrdinalCell(localName)
    local.from(externalGadget)
    this.add(local)
    return local
  }
  
  // Helper for creating an exports namespace
  createExports(...gadgets: Gadget[]): Network {
    const exports = new Network("exports")
    exports.add(...gadgets)
    this.addChildNetwork(exports)
    return exports
  }
  
  // Debug helper
  printState(indent: string = ""): void {
    console.log(`${indent}=== Network: ${this.id} ===`)
    console.log(`${indent}Gadgets: ${this.gadgets.size}`)
    
    // Print all gadgets
    for (const gadget of this.gadgets) {
      if (gadget === (this as Gadget)) continue  // Don't print ourselves
      
      if (gadget instanceof Network) {
        // Child network - recurse with indentation
        console.log(`${indent}  [Child Network]`)
        gadget.printState(indent + "    ")
      } else {
        // Regular gadget
        console.log(`${indent}  ${gadget.id}: ${JSON.stringify(gadget.getOutput("default"))}`)
      }
    }
    
    console.log(`${indent}===================`)
  }
  
  // Serialize network to JSON
  serialize(): any {
    const base = super.serialize()
    
    // Add network-specific data
    base.type = 'network'
    
    // Serialize all gadgets
    base.gadgets = []
    for (const gadget of this.gadgets) {
      if (gadget === (this as Gadget)) continue  // Don't serialize ourselves recursively
      base.gadgets.push(gadget.serialize())
    }
    
    // Serialize child networks (for easy lookup)
    base.childNetworks = {}
    for (const [name, child] of this.childNetworks) {
      base.childNetworks[name] = child.id
    }
    
    // Note parent ID if exists
    const parent = (this.parent as any)?.deref()
    if (parent) {
      base.parentId = parent.id
    }
    
    return base
  }
  
  // Deserialize a network from JSON
  static deserialize(data: any, registry: any): Network {
    // Let the registry handle it since it knows about gadget types
    return registry.deserializeNetwork(data)
  }
}