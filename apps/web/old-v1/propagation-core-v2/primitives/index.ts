import { mathGadgets } from './math'
import { stringGadgets } from './string'
import { logicGadgets } from './logic'
import { controlGadgets } from './control'
import { arrayGadgets } from './array'
import type { PrimitiveGadget } from '../types'

// Export all primitive gadgets
export const allPrimitiveGadgets = [
  ...mathGadgets,
  ...stringGadgets,
  ...logicGadgets,
  ...controlGadgets,
  ...arrayGadgets
]

// Create a map for easy lookup
export const primitiveGadgetMap = new Map<string, PrimitiveGadget>(
  allPrimitiveGadgets.map(gadget => [gadget.id, gadget])
)

// Helper to get gadget by ID
export function getPrimitiveGadget(id: string): PrimitiveGadget | undefined {
  return primitiveGadgetMap.get(id)
}

// Helper to get gadgets by category
export function getGadgetsByCategory(category: PrimitiveGadget['category']): PrimitiveGadget[] {
  return allPrimitiveGadgets.filter(gadget => gadget.category === category)
}

// Re-export individual categories
export { mathGadgets } from './math'
export { stringGadgets } from './string'
export { logicGadgets } from './logic'
export { controlGadgets } from './control'
export { arrayGadgets } from './array'