import type { GadgetTemplate } from './types/template'
import type { ContactGroup } from './models/ContactGroup'
import { Adder } from './primitives/arithmetic/Adder'
import { Subtractor } from './primitives/arithmetic/Subtractor'  
import { Multiplier } from './primitives/arithmetic/Multiplier'
import { Divider } from './primitives/arithmetic/Divider'
import { Union } from './primitives/set/Union'
import { Intersection } from './primitives/set/Intersection'
import { Difference } from './primitives/set/Difference'
import { Splitter } from './primitives/data/Splitter'
import { Joiner } from './primitives/data/Joiner'
import type { PrimitiveGadget } from './primitives/base/PrimitiveGadget'

// Type for primitive gadget constructor
type PrimitiveConstructor = new (parent?: ContactGroup) => PrimitiveGadget

// Registry of all primitive gadgets
export const PRIMITIVE_GADGETS: Record<string, PrimitiveConstructor> = {
  // Arithmetic
  'Adder': Adder,
  'Subtractor': Subtractor,
  'Multiplier': Multiplier,
  'Divider': Divider,
  // Set operations
  'Union': Union,
  'Intersection': Intersection,
  'Difference': Difference,
  // Data flow
  'Splitter': Splitter as any, // Cast needed due to constructor params
  'Splitter3': Splitter as any,
  'Joiner': Joiner as any,
  'Joiner3': Joiner as any,
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
  
  // Union template
  templates.push({
    name: 'Union',
    description: 'Union of two sets (A ∪ B)',
    category: 'Set Operations',
    contacts: [
      { position: { x: 50, y: 80 }, isBoundary: true, boundaryDirection: 'input', name: 'a', blendMode: 'accept-last' },
      { position: { x: 50, y: 120 }, isBoundary: true, boundaryDirection: 'input', name: 'b', blendMode: 'accept-last' },
      { position: { x: 350, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'result', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Intersection template
  templates.push({
    name: 'Intersection',
    description: 'Intersection of two sets (A ∩ B)',
    category: 'Set Operations',
    contacts: [
      { position: { x: 50, y: 80 }, isBoundary: true, boundaryDirection: 'input', name: 'a', blendMode: 'accept-last' },
      { position: { x: 50, y: 120 }, isBoundary: true, boundaryDirection: 'input', name: 'b', blendMode: 'accept-last' },
      { position: { x: 350, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'result', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Difference template
  templates.push({
    name: 'Difference',
    description: 'Set difference (A - B)',
    category: 'Set Operations',
    contacts: [
      { position: { x: 50, y: 80 }, isBoundary: true, boundaryDirection: 'input', name: 'a', blendMode: 'accept-last' },
      { position: { x: 50, y: 120 }, isBoundary: true, boundaryDirection: 'input', name: 'b', blendMode: 'accept-last' },
      { position: { x: 350, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'result', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2]
  })
  
  // Splitter template
  templates.push({
    name: 'Splitter3',
    description: 'Splits one input to three outputs',
    category: 'Data Flow',
    contacts: [
      { position: { x: 50, y: 100 }, isBoundary: true, boundaryDirection: 'input', name: 'in', blendMode: 'accept-last' },
      { position: { x: 350, y: 30 }, isBoundary: true, boundaryDirection: 'output', name: 'out1', blendMode: 'accept-last' },
      { position: { x: 350, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'out2', blendMode: 'accept-last' },
      { position: { x: 350, y: 170 }, isBoundary: true, boundaryDirection: 'output', name: 'out3', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2, 3]
  })
  
  // Joiner template
  templates.push({
    name: 'Joiner3',
    description: 'Joins three inputs into an array',
    category: 'Data Flow',
    contacts: [
      { position: { x: 50, y: 30 }, isBoundary: true, boundaryDirection: 'input', name: 'in1', blendMode: 'accept-last' },
      { position: { x: 50, y: 100 }, isBoundary: true, boundaryDirection: 'input', name: 'in2', blendMode: 'accept-last' },
      { position: { x: 50, y: 170 }, isBoundary: true, boundaryDirection: 'input', name: 'in3', blendMode: 'accept-last' },
      { position: { x: 350, y: 100 }, isBoundary: true, boundaryDirection: 'output', name: 'out', blendMode: 'accept-last' }
    ],
    wires: [],
    subgroupTemplates: [],
    boundaryIndices: [0, 1, 2, 3]
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
  
  // Special handling for gadgets with custom constructors
  if (name === 'Splitter' || name === 'Splitter3') {
    return new Splitter(parent, 3)
  } else if (name === 'Joiner' || name === 'Joiner3') {
    return new Joiner(parent, 3)
  }
  
  return new Constructor(parent)
}