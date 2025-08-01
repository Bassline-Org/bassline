import type { GadgetTemplate } from './types/template'
import type { ContactGroup } from './models/ContactGroup'
import { Adder, Subtractor, Multiplier, Divider } from './primitives'
import type { PrimitiveGadget } from './primitives'

// Type for primitive gadget constructor
type PrimitiveConstructor = new (parent?: ContactGroup) => PrimitiveGadget

// Registry of all primitive gadgets
export const PRIMITIVE_GADGETS: Record<string, PrimitiveConstructor> = {
  'Adder': Adder,
  'Subtractor': Subtractor,
  'Multiplier': Multiplier,
  'Divider': Divider,
}

// Create templates for primitive gadgets that can be added to the palette
export function createPrimitiveTemplates(): GadgetTemplate[] {
  const templates: GadgetTemplate[] = []
  
  // Adder template
  templates.push({
    name: 'Adder',
    description: 'Adds two numbers or intervals (a + b = sum)',
    category: 'Math',
    contacts: [
      { position: { x: 50, y: 50 }, isBoundary: true, boundaryDirection: 'input', name: 'a', blendMode: 'accept-last' },
      { position: { x: 50, y: 150 }, isBoundary: true, boundaryDirection: 'input', name: 'b', blendMode: 'accept-last' },
      { position: { x: 250, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'sum', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Subtractor template
  templates.push({
    name: 'Subtractor',
    description: 'Subtracts two numbers or intervals (minuend - subtrahend = difference)',
    category: 'Math',
    contacts: [
      { position: { x: 50, y: 50 }, isBoundary: true, boundaryDirection: 'input', name: 'minuend', blendMode: 'accept-last' },
      { position: { x: 50, y: 150 }, isBoundary: true, boundaryDirection: 'input', name: 'subtrahend', blendMode: 'accept-last' },
      { position: { x: 250, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'difference', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Multiplier template
  templates.push({
    name: 'Multiplier',
    description: 'Multiplies two numbers or intervals (a × b = product)',
    category: 'Math',
    contacts: [
      { position: { x: 50, y: 50 }, isBoundary: true, boundaryDirection: 'input', name: 'a', blendMode: 'accept-last' },
      { position: { x: 50, y: 150 }, isBoundary: true, boundaryDirection: 'input', name: 'b', blendMode: 'accept-last' },
      { position: { x: 250, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'product', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Divider template  
  templates.push({
    name: 'Divider',
    description: 'Divides two numbers or intervals (dividend ÷ divisor = quotient)',
    category: 'Math',
    contacts: [
      { position: { x: 50, y: 50 }, isBoundary: true, boundaryDirection: 'input', name: 'dividend', blendMode: 'accept-last' },
      { position: { x: 50, y: 150 }, isBoundary: true, boundaryDirection: 'input', name: 'divisor', blendMode: 'accept-last' },
      { position: { x: 250, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'quotient', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  return templates
}

// Factory function to instantiate a primitive gadget
export function createPrimitiveGadget(name: string, parent?: ContactGroup): PrimitiveGadget | null {
  const Constructor = PRIMITIVE_GADGETS[name]
  if (!Constructor) {
    console.warn(`Unknown primitive gadget: ${name}`)
    return null
  }
  
  return new Constructor(parent)
}