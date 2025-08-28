/**
 * Proper Bassline - Lattice-based propagation networks
 */

// Core classes
export { Gadget } from './gadget'
export { Cell } from './cell'
export { FunctionGadget } from './function'
export { Network } from './network'
export { BasslineEngine } from './engine'
export type { PropagationEvent, PropagationListener } from './engine'

// Core metamodel
export type { GadgetBase, Container } from './gadget-base'
export { isGadgetBase, isContainer } from './gadget-base'
export { Query, query } from './query'

// Basic cells
export { 
  MaxCell, 
  MinCell, 
  OrCell, 
  AndCell, 
  UnionCell, 
  LatestCell,
  OrdinalCell 
} from './cells/basic'

// Types and utilities
export {
  type LatticeValue,
  type Connection,
  
  // Constructors
  nil,
  bool,
  num,
  str,
  set,
  dict,
  map,
  contradiction,
  
  // Type guards
  isBool,
  isNumber,
  isString,
  isSet,
  isNull,
  isDict,
  
  // Utilities
  getValue,
  getOrdinal,
  getDictValue
} from './lattice-types'

// Value helpers
export { extractValue, getGadgetValue } from './value-helpers'

// Query and View gadgets
export { QueryGadget } from './query-gadget'

// Port-graph interpreter
export { PortGraphInterpreter, PRIMITIVES } from './interpreter'