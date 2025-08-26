/**
 * GadgetRegistryGadget - A gadget that manages available gadget types
 * 
 * This allows the editor to spawn different types of gadgets dynamically.
 * It maintains a registry of constructors and templates.
 */

import { Network } from '../src/network'
import { OrdinalCell } from '../src/cells/basic'
import { obj, dict, array, str, nil } from '../src/types'
import type { LatticeValue } from '../src/types'
import { Gadget } from '../src/gadget'

// Import all the gadget types we want to register
import { MaxCell, MinCell, SetCell, OrCell, AndCell, UnionCell, LatestCell } from '../src/cells/basic'
import { AddFunction, MultiplyFunction, SubtractFunction, DivideFunction, EqualFunction, GreaterThanFunction } from '../src/functions/basic'
import { ExtractValue, ExtractOrdinal } from '../src/functions/extract'
import { NestFunction } from '../src/functions/nest'

// Type for gadget constructor info
export interface GadgetTypeInfo {
  name: string           // Friendly display name
  className: string      // Class name for serialization
  category: string       // Category for grouping (cell, function, network)
  description: string    // Brief description
  constructor: new (id: string, ...args: any[]) => Gadget
  defaultArgs?: any[]   // Default constructor arguments after ID
}

/**
 * GadgetRegistryGadget - Manages available gadget types
 */
export class GadgetRegistryGadget extends Network {
  // Registry state cells
  readonly availableTypes: OrdinalCell    // List of available gadget types
  readonly selectedType: OrdinalCell      // Currently selected type for creation
  readonly templates: OrdinalCell         // Saved gadget templates
  readonly categories: OrdinalCell        // Categories for organization
  
  // Internal registry
  private typeRegistry: Map<string, GadgetTypeInfo> = new Map()
  
  constructor(id: string) {
    super(id)
    
    // Initialize cells
    this.availableTypes = new OrdinalCell(`${id}-types`)
    this.selectedType = new OrdinalCell(`${id}-selected`)
    this.templates = new OrdinalCell(`${id}-templates`)
    this.categories = new OrdinalCell(`${id}-categories`)
    
    // Add cells to network
    this.add(
      this.availableTypes,
      this.selectedType,
      this.templates,
      this.categories
    )
    
    // Mark as boundaries for external access
    this.addBoundary(this.availableTypes)
    this.addBoundary(this.selectedType)
    this.addBoundary(this.templates)
    this.addBoundary(this.categories)
    
    // Register built-in types
    this.registerBuiltinTypes()
    console.log('Registry: registered types count:', this.typeRegistry.size)
    
    // Set initial state
    this.updateAvailableTypes()
    console.log('Registry: availableTypes updated')
    this.selectedType.userInput(str('OrdinalCell'))
    this.templates.userInput(dict(new Map()))
    this.categories.userInput(array([
      str('Cells'),
      str('Functions'),
      str('Networks')
    ]))
  }
  
  /**
   * Register all built-in gadget types
   */
  private registerBuiltinTypes() {
    // Register Cells
    this.registerType({
      name: 'Ordinal Cell',
      className: 'OrdinalCell',
      category: 'Cells',
      description: 'Stores the latest value (last-write-wins)',
      constructor: OrdinalCell
    })
    
    this.registerType({
      name: 'Max Cell',
      className: 'MaxCell',
      category: 'Cells',
      description: 'Outputs the maximum of all inputs',
      constructor: MaxCell
    })
    
    this.registerType({
      name: 'Min Cell',
      className: 'MinCell',
      category: 'Cells',
      description: 'Outputs the minimum of all inputs',
      constructor: MinCell
    })
    
    this.registerType({
      name: 'Set Cell',
      className: 'SetCell',
      category: 'Cells',
      description: 'Grow-only set that unions all inputs',
      constructor: SetCell
    })
    
    this.registerType({
      name: 'OR Cell',
      className: 'OrCell',
      category: 'Cells',
      description: 'Logical OR of boolean inputs',
      constructor: OrCell
    })
    
    this.registerType({
      name: 'AND Cell',
      className: 'AndCell',
      category: 'Cells',
      description: 'Logical AND of boolean inputs',
      constructor: AndCell
    })
    
    this.registerType({
      name: 'Union Cell',
      className: 'UnionCell',
      category: 'Cells',
      description: 'Union of set inputs',
      constructor: UnionCell
    })
    
    this.registerType({
      name: 'Latest Cell',
      className: 'LatestCell',
      category: 'Cells',
      description: 'Tracks the most recent value',
      constructor: LatestCell
    })
    
    // Register Functions
    this.registerType({
      name: 'Add',
      className: 'AddFunction',
      category: 'Functions',
      description: 'Adds two numbers (a + b)',
      constructor: AddFunction
    })
    
    this.registerType({
      name: 'Multiply',
      className: 'MultiplyFunction',
      category: 'Functions',
      description: 'Multiplies two numbers (a × b)',
      constructor: MultiplyFunction
    })
    
    this.registerType({
      name: 'Subtract',
      className: 'SubtractFunction',
      category: 'Functions',
      description: 'Subtracts two numbers (minuend - subtrahend)',
      constructor: SubtractFunction
    })
    
    this.registerType({
      name: 'Divide',
      className: 'DivideFunction',
      category: 'Functions',
      description: 'Divides two numbers (dividend ÷ divisor)',
      constructor: DivideFunction
    })
    
    this.registerType({
      name: 'Equals',
      className: 'EqualFunction',
      category: 'Functions',
      description: 'Tests if two values are equal',
      constructor: EqualFunction
    })
    
    this.registerType({
      name: 'Greater Than',
      className: 'GreaterThanFunction',
      category: 'Functions',
      description: 'Tests if a > b',
      constructor: GreaterThanFunction
    })
    
    this.registerType({
      name: 'Extract Value',
      className: 'ExtractValue',
      category: 'Functions',
      description: 'Extracts value from ordinal dictionary',
      constructor: ExtractValue
    })
    
    this.registerType({
      name: 'Extract Ordinal',
      className: 'ExtractOrdinal',
      category: 'Functions',
      description: 'Extracts ordinal number from ordinal dictionary',
      constructor: ExtractOrdinal
    })
    
    // Register Networks
    this.registerType({
      name: 'Nested Network',
      className: 'NestFunction',
      category: 'Networks',
      description: 'A sub-network that can contain other gadgets',
      constructor: NestFunction
    })
    
    this.registerType({
      name: 'Network',
      className: 'Network',
      category: 'Networks',
      description: 'Basic network container',
      constructor: Network
    })
  }
  
  /**
   * Register a gadget type
   */
  registerType(info: GadgetTypeInfo) {
    this.typeRegistry.set(info.className, info)
    this.updateAvailableTypes()
  }
  
  /**
   * Update the available types cell
   */
  private updateAvailableTypes() {
    const types = Array.from(this.typeRegistry.values()).map(info => 
      obj({
        name: info.name,
        className: info.className,
        category: info.category,
        description: info.description
      })
    )
    this.availableTypes.userInput(array(types))
  }
  
  /**
   * Create a gadget of the specified type
   */
  createGadget(className: string, id: string, ...args: any[]): Gadget | null {
    const typeInfo = this.typeRegistry.get(className)
    if (!typeInfo) return null
    
    const fullArgs = typeInfo.defaultArgs ? [...args, ...typeInfo.defaultArgs] : args
    return new typeInfo.constructor(id, ...fullArgs)
  }
  
  /**
   * Create a gadget of the currently selected type
   */
  createSelectedGadget(id: string): Gadget | null {
    const selected = this.selectedType.getOutput()
    
    // Extract from ordinal
    let className: string | null = null
    if (selected?.type === 'dict') {
      const innerValue = selected.value.get('value')
      if (innerValue?.type === 'string') {
        className = innerValue.value
      }
    } else if (selected?.type === 'string') {
      className = selected.value
    }
    
    if (!className) return null
    return this.createGadget(className, id)
  }
  
  /**
   * Save a gadget as a template
   */
  saveAsTemplate(gadget: Gadget, templateName: string) {
    const current = this.templates.getOutput()
    
    // Extract current templates
    let currentTemplates = new Map<string, any>()
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'dict') {
        currentTemplates = new Map(innerValue.value)
      }
    } else if (current?.type === 'dict') {
      currentTemplates = new Map(current.value)
    }
    
    // Add new template (serialized gadget)
    currentTemplates.set(templateName, obj(gadget.serialize()))
    this.templates.userInput(dict(currentTemplates))
  }
  
  /**
   * Instantiate a gadget from a template
   */
  instantiateTemplate(templateName: string, newId?: string): Gadget | null {
    const current = this.templates.getOutput()
    
    // Extract templates
    let templates: Map<string, any> | null = null
    if (current?.type === 'dict') {
      const innerValue = current.value.get('value')
      if (innerValue?.type === 'dict') {
        templates = innerValue.value
      }
    } else if (current?.type === 'dict') {
      templates = current.value
    }
    
    if (!templates) return null
    
    const templateData = templates.get(templateName)
    if (!templateData || templateData.type !== 'object') return null
    
    // Clone template data and assign new ID
    const data = JSON.parse(JSON.stringify(templateData.value))
    if (newId) data.id = newId
    
    // Use global registry to deserialize
    // Note: In a real implementation, we'd need to import and use the global registry
    // For now, we'll just return null - this would be connected to the actual registry
    return null
  }
  
  /**
   * Get info for a specific type
   */
  getTypeInfo(className: string): GadgetTypeInfo | undefined {
    return this.typeRegistry.get(className)
  }
  
  /**
   * Get all types in a category
   */
  getTypesByCategory(category: string): GadgetTypeInfo[] {
    return Array.from(this.typeRegistry.values())
      .filter(info => info.category === category)
  }
  
  /**
   * Select a type for creation
   */
  selectType(className: string) {
    if (this.typeRegistry.has(className)) {
      this.selectedType.userInput(str(className))
    }
  }
}