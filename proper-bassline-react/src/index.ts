/**
 * proper-bassline-react
 * React bindings and components for proper-bassline propagation networks
 */

// Export all hooks
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