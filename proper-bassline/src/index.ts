/**
 * Proper Bassline - Lattice-based propagation networks
 */

// Core classes
export { Gadget } from './gadget'
export { Cell } from './cell'
export { FunctionGadget } from './function'
export { Network } from './network'

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
  map,
  contradiction,
  
  // Type guards
  isBool,
  isNumber,
  isString,
  isSet,
  isNull,
  isMap,
  
  // Utilities
  getValue,
  ordinalValue,
  getOrdinal,
  getMapValue
} from './types'

// React integration
export { 
  NetworkContext,
  NetworkProvider,
  useNetwork,
  useCell
} from './react-integration'