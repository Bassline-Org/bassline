/**
 * NestFunction - Explicit hierarchy creation
 * 
 * This is a function (not a lattice operation) because:
 * - Order matters (parent vs child)
 * - Not commutative (nest(A,B) ≠ nest(B,A))
 * - Not associative
 */

import { FunctionGadget } from '../function'
import { LatticeValue, str } from '../types'
import { Network } from '../network'

export class NestFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['parent', 'child'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // In a real implementation, this would actually nest networks
    // For now, just return a description
    return str(`nested[parent=${args.parent.type}, child=${args.child.type}]`)
  }
  
  // Special method to actually perform nesting on Network objects
  nestNetworks(parent: Network, child: Network): void {
    parent.addChildNetwork(child)
  }
}