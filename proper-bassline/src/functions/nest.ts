/**
 * NestFunction - Explicit hierarchy creation
 * 
 * This is a function (not a lattice operation) because:
 * - Order matters (parent vs child)
 * - Not commutative (nest(A,B) ≠ nest(B,A))
 * - Not associative
 */

import { FunctionGadget } from '../function'
import { LatticeValue, str } from '../lattice-types'
import { Network } from '../network'

type NestFunctionArgs = {parent: LatticeValue<Network>, child: LatticeValue<Network>}
export class NestFunction extends FunctionGadget<NestFunctionArgs> {
  constructor(id: string) {
    super(id, ['parent', 'child'])
  }
  
  fn(args: NestFunctionArgs): LatticeValue {
    // In a real implementation, this would actually nest networks
    // For now, just return a description
    return str(`nested[parent=${args['parent'].type}, child=${args['child'].type}]`)
  }
  
  // Special method to actually perform nesting on Network objects
  nestNetworks(parent: Network, child: Network): void {
    parent.addChildNetwork(child)
  }
}