/**
 * Proper Bassline - Lattice-based propagation networks
 */

// Core classes
export { Gadget } from './gadget'
export { Cell } from './cell'
export { FunctionGadget } from './function'
export { Network } from './network'

// Core metamodel
export type { GadgetBase, Container } from './gadget-base'
export { isGadgetBase, isContainer } from './gadget-base'
export { NetworkValue, isNetworkValue, getNetwork, networkValue } from './network-value'
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
  useCell,
  useGadget
} from './react-integration'

// Registry and editor gadgets
export { GadgetRegistryGadget, type GadgetTypeInfo } from './gadget-registry'
export { EditorGadget } from './editor-gadget'

// Value helpers
export { extractValue, getGadgetValue } from './value-helpers'

// Visual gadgets
export { VisualGadget } from './visual-gadget'
export type { Point, Size, Rect, StyleMap } from './visual-gadget'
export { RectGadget, TextGadget, PathGadget, GroupGadget } from './visuals'

// Affordances
export { Affordance } from './affordance'
export type { InputEvent } from './affordance'
export { 
  TapAffordance, 
  DragAffordance, 
  HoverAffordance, 
  TypeAffordance, 
  DropAffordance 
} from './affordances'

// Query and View gadgets
export { QueryGadget } from './query-gadget'
export { ProjectionGadget } from './projection-gadget'
export { 
  ViewGadget,
  createListView,
  createGridView,
  createTreeView
} from './view-gadget'