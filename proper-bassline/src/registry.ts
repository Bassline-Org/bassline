/**
 * Gadget Registry - Maps class names to constructors for deserialization
 * 
 * This registry allows us to reconstruct gadgets from their serialized form.
 * It can also serve as a template library for creating new gadget instances.
 */

import { Gadget } from './gadget'
import { Cell } from './cell'
import { Network } from './network'
import { OrdinalCell, MaxCell, MinCell, SetCell } from './cells/basic'
import { VisualNode } from '../meta/visual-node'
import { FunctionGadget } from './function'
import { ExtractValue, ExtractOrdinal } from './functions/extract'
import { deserialize as deserializeLattice } from './lattice-types'

// Type for gadget constructors
export type GadgetConstructor = {
  new(id: string, ...args: any[]): Gadget
  deserialize?: (data: any, registry: GadgetRegistry) => Gadget
}

// Global registry of gadget types
export class GadgetRegistry {
  private constructors: Map<string, GadgetConstructor> = new Map()
  private templates: Map<string, any> = new Map()  // Serialized templates
  
  constructor() {
    // Register built-in types
    this.registerBuiltins()
  }
  
  // Register core gadget types
  private registerBuiltins() {
    this.register('OrdinalCell', OrdinalCell)
    this.register('MaxCell', MaxCell)
    this.register('MinCell', MinCell)
    this.register('SetCell', SetCell)
    this.register('Network', Network)
    this.register('VisualNode', VisualNode)
    this.register('ExtractValue', ExtractValue)
    this.register('ExtractOrdinal', ExtractOrdinal)
  }
  
  // Register a gadget constructor
  register(className: string, constructor: GadgetConstructor) {
    this.constructors.set(className, constructor)
  }
  
  // Get a constructor by class name
  getConstructor(className: string): GadgetConstructor | undefined {
    return this.constructors.get(className)
  }
  
  // Save a gadget template
  saveTemplate(name: string, gadget: Gadget) {
    this.templates.set(name, gadget.serialize())
  }
  
  // Get a saved template
  getTemplate(name: string): any | undefined {
    return this.templates.get(name)
  }
  
  // Create a gadget from a template
  instantiateTemplate(templateName: string, newId?: string): Gadget | null {
    const template = this.templates.get(templateName)
    if (!template) return null
    
    // Clone the template and give it a new ID
    const data = JSON.parse(JSON.stringify(template))
    if (newId) data.id = newId
    
    return this.deserialize(data)
  }
  
  // Deserialize a gadget from data
  deserialize(data: any): Gadget | null {
    const className = data.className
    const constructor = this.constructors.get(className)
    
    if (!constructor) {
      console.warn(`Unknown gadget class: ${className}`)
      return null
    }
    
    // Use custom deserialize if available
    if (constructor.deserialize) {
      return constructor.deserialize(data, this)
    }
    
    // Generic deserialization for cells
    if (className.endsWith('Cell')) {
      return this.deserializeCell(data, constructor)
    }
    
    // Generic deserialization for functions
    if (data.type === 'function') {
      return this.deserializeFunction(data, constructor)
    }
    
    // Generic deserialization for networks
    if (className === 'Network' || className === 'VisualNode') {
      return this.deserializeNetwork(data)
    }
    
    console.warn(`No deserializer for ${className}`)
    return null
  }
  
  // Deserialize a cell
  private deserializeCell(data: any, constructor: GadgetConstructor): Cell | null {
    const cell = new constructor(data.id) as Cell
    
    // Restore output values
    if (data.outputs && data.outputs.default) {
      const value = deserializeLattice(data.outputs.default)
      // @ts-ignore - protected method
      cell.setOutput('default', value, false)  // Don't emit during deserialization
    }
    
    // Restore boundary flag
    if (data.boundary) {
      cell.makeBoundary()
    }
    
    // Note: Connections will be restored later in a second pass
    
    return cell
  }
  
  // Deserialize a network
  private deserializeNetwork(data: any): Network | null {
    let network: Network
    
    if (data.className === 'VisualNode') {
      // VisualNode needs special handling
      network = new VisualNode(data.id)
    } else {
      network = new Network(data.id)
    }
    
    // First pass: Create all gadgets
    const gadgetMap = new Map<string, Gadget>()
    gadgetMap.set(network.id, network)
    
    if (data.gadgets) {
      for (const gadgetData of data.gadgets) {
        const gadget = this.deserialize(gadgetData)
        if (gadget) {
          network.add(gadget)
          gadgetMap.set(gadget.id, gadget)
        }
      }
    }
    
    // Second pass: Restore connections
    if (data.gadgets) {
      for (const gadgetData of data.gadgets) {
        this.restoreConnections(gadgetData, gadgetMap)
      }
    }
    
    // For VisualNode, restore references to visual cells
    if (data.className === 'VisualNode' && data.visualProperties) {
      const vn = network as VisualNode
      const props = data.visualProperties
      
      // Find and assign visual property cells
      if (props.positionId) {
        const posCell = gadgetMap.get(props.positionId)
        if (posCell) vn.position = posCell as OrdinalCell
      }
      if (props.sizeId) {
        const sizeCell = gadgetMap.get(props.sizeId)
        if (sizeCell) vn.size = sizeCell as OrdinalCell
      }
      if (props.selectedId) {
        const selCell = gadgetMap.get(props.selectedId)
        if (selCell) vn.selected = selCell as OrdinalCell
      }
      if (props.collapsedId) {
        const colCell = gadgetMap.get(props.collapsedId)
        if (colCell) vn.collapsed = colCell as OrdinalCell
      }
      if (props.contentId || data.contentId) {
        const content = gadgetMap.get(props.contentId || data.contentId)
        if (content) vn.content = content
      }
    }
    
    return network
  }
  
  // Deserialize a function
  private deserializeFunction(data: any, constructor: GadgetConstructor): FunctionGadget | null {
    // Functions need their input names
    const func = new constructor(data.id) as FunctionGadget
    
    // Restore output values
    if (data.outputs) {
      for (const [name, value] of Object.entries(data.outputs)) {
        const latticeValue = deserializeLattice(value as any)
        // @ts-ignore - protected method
        func.setOutput(name, latticeValue, false)
      }
    }
    
    // Restore current values
    if (data.currentValues) {
      for (const [name, value] of Object.entries(data.currentValues)) {
        if (value) {
          func.currentValues.set(name, deserializeLattice(value as any))
        }
      }
    }
    
    // Note: Connections will be restored later
    return func
  }
  
  // Restore connections between gadgets
  private restoreConnections(data: any, gadgetMap: Map<string, Gadget>) {
    const target = gadgetMap.get(data.id)
    if (!target) return
    
    // For cells
    if (data.inputs && Array.isArray(data.inputs)) {
      for (const input of data.inputs) {
        const source = gadgetMap.get((input as any).sourceId)
        if (source && 'connectFrom' in target) {
          (target as Cell).connectFrom(source, input.outputName || 'default')
        }
      }
    }
    
    // For functions (named inputs)
    if (data.inputs && typeof data.inputs === 'object' && !Array.isArray(data.inputs)) {
      for (const [inputName, input] of Object.entries(data.inputs as any)) {
        const source = gadgetMap.get((input as any).sourceId)
        if (source && 'connectFrom' in target) {
          (target as any).connectFrom(inputName, source, (input as any).outputName || 'default')
        }
      }
    }
  }
}

// Global registry instance
export const globalRegistry = new GadgetRegistry()