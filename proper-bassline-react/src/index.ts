/**
 * proper-bassline-react
 * React bindings and components for proper-bassline propagation networks
 */

// Export all hooks - first try hooks.tsx, fallback to react-integration
export {
  NetworkContext,
  NetworkProvider,
  useNetwork,
  useCell,
  useGadget,
  useFunctionOutput,
  useWiring,
  useImport
} from './hooks'

// Export visual components
export { 
  RectGadgetComponent,
  TextGadgetComponent,
  GroupGadgetComponent,
  VisualGadgetRenderer
} from './react-visuals'

// Export affordance components
export { 
  TapAffordanceComponent,
  DragAffordanceComponent,
  HoverAffordanceComponent,
  TypeAffordanceComponent,
  Interactive
} from './react-affordances'

// Export canvas components
export {
  NetworkCanvas,
  ViewCanvas,
  InteractiveCanvas
} from './network-canvas'

// Export Rete.js integration
export { ReteNetworkEditor } from './rete/ReteNetworkEditor'

// Re-export commonly used types from proper-bassline for convenience
export type { 
  Gadget,
  LatticeValue,
  SerializedLatticeValue 
} from 'proper-bassline/src/types'

export { 
  Network,
  Cell,
  FunctionGadget 
} from 'proper-bassline/src/index'