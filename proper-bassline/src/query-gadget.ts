/**
 * QueryGadget - A FunctionGadget that queries networks
 * 
 * Takes two inputs:
 * - network: A NetworkValue
 * - selector: A query selector string
 * 
 * Outputs a set of matching gadget IDs
 */

import { FunctionGadget } from './function'
import { Network } from './network'
import { str, set as makeSet } from './lattice-types'
import { LatticeBox, LatticeString, LatticeValue } from './lattice-types'

/**
 * QueryGadget - Executes queries on networks
 */
type QueryGadgetArgs = {
  network: LatticeBox<Network>,
  selector: LatticeString
}

export class QueryGadget extends FunctionGadget<QueryGadgetArgs> {
  constructor(id: string = 'query') {
    super(id, ['network', 'selector'])
  }
  
  fn(args: QueryGadgetArgs): LatticeValue {
    // Extract the actual network from OrdinalCell's output (which is a dict)
    let networkValue = args.network.value
    
    // Extract the actual selector from OrdinalCell's output
    let selectorValue = args.selector.value
    
    if (!networkValue || typeof selectorValue !== 'string') {
      return makeSet(new Set<LatticeValue>())
    }
    
    // Just call query on the network!
    const results = networkValue.query(selectorValue)
    
    // Convert gadgets to IDs since gadgets can't be values
    const resultIds = Array.from(results).map(g => str(g.id))
    return makeSet(resultIds)
  }
}