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
import { getNetwork } from './network-value'
import { str, set as makeSet } from './types'
import type { LatticeValue } from './types'

/**
 * QueryGadget - Executes queries on networks
 */
export class QueryGadget extends FunctionGadget {
  constructor(id: string = 'query') {
    super(id, ['network', 'selector'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // Extract the actual network from OrdinalCell's output (which is a dict)
    let networkValue = args.network
    if (networkValue?.type === 'dict' && networkValue.value.has('value')) {
      networkValue = networkValue.value.get('value') || networkValue
    }
    const network = getNetwork(networkValue)
    
    // Extract the actual selector from OrdinalCell's output
    let selectorValue = args.selector
    if (selectorValue?.type === 'dict' && selectorValue.value.has('value')) {
      selectorValue = selectorValue.value.get('value') || selectorValue
    }
    
    if (!network || selectorValue?.type !== 'string') {
      return makeSet(new Set<LatticeValue>())
    }
    
    // Just call query on the network!
    const results = network.query(selectorValue.value)
    
    // Convert gadgets to IDs since gadgets can't be values
    const resultIds = Array.from(results).map(g => str(g.id))
    return makeSet(resultIds)
  }
}