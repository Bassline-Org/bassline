/**
 * ViewGadget - Simple composition of query and projection gadgets
 * 
 * This demonstrates how to build complex UI behavior by composing
 * simple FunctionGadgets through the propagation network.
 */

import { Network } from './network'
import { OrdinalCell } from './cells/basic'
import { QueryGadget } from './query-gadget'
import { ProjectionGadget } from './projection-gadget'
import { networkValue } from './network-value'
import { str, num, dict } from './types'
import type { LatticeValue } from './types'

/**
 * ViewGadget - A network that wires together query and projection
 */
export class ViewGadget extends Network {
  // Input cells
  networkInput: OrdinalCell
  selector: OrdinalCell
  layoutType: OrdinalCell
  layoutParams: OrdinalCell
  
  // Function gadgets
  query: QueryGadget
  projection: ProjectionGadget
  
  // Output cell
  results: OrdinalCell
  
  constructor(id: string = 'view') {
    super(id)
    
    // Create cells
    this.networkInput = new OrdinalCell(`${id}-network`)
    this.selector = new OrdinalCell(`${id}-selector`)
    this.layoutType = new OrdinalCell(`${id}-layout`)
    this.layoutParams = new OrdinalCell(`${id}-params`)
    this.results = new OrdinalCell(`${id}-results`)
    
    // Set defaults
    this.selector.userInput(str('*'))
    this.layoutType.userInput(str('list'))
    this.layoutParams.userInput(dict(new Map([
      ['spacing', num(10)],
      ['orientation', str('vertical')]
    ])))
    
    // Create function gadgets
    this.query = new QueryGadget(`${id}-query`)
    this.projection = new ProjectionGadget(`${id}-projection`)
    
    // Wire query inputs
    this.query.connectFrom('network', this.networkInput)
    this.query.connectFrom('selector', this.selector)
    
    // Wire projection inputs
    this.projection.connectFrom('results', this.query)
    this.projection.connectFrom('layout', this.layoutType)
    this.projection.connectFrom('params', this.layoutParams)
    
    // Wire output
    this.results.connectFrom(this.projection)
    
    // Add everything to the network
    this.add(
      this.networkInput,
      this.selector,
      this.layoutType,
      this.layoutParams,
      this.results,
      this.query,
      this.projection
    )
    
    // Set metadata
    this.setMetadata('gadgetType', 'view')
  }
  
  /**
   * Connect to a network to observe
   */
  observeNetwork(network: Network): this {
    this.networkInput.userInput(networkValue(network))
    return this
  }
  
  /**
   * Set the query selector
   */
  setSelector(selector: string): this {
    this.selector.userInput(str(selector))
    return this
  }
  
  /**
   * Set the layout type
   */
  setLayout(type: 'list' | 'grid' | 'tree'): this {
    this.layoutType.userInput(str(type))
    return this
  }
  
  /**
   * Set layout parameters
   */
  setLayoutParams(params: Record<string, any>): this {
    const paramMap = new Map<string, LatticeValue>()
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number') {
        paramMap.set(key, num(value))
      } else if (typeof value === 'string') {
        paramMap.set(key, str(value))
      }
    }
    
    this.layoutParams.userInput(dict(paramMap))
    return this
  }
}

/**
 * Create a simple list view
 */
export function createListView(
  id: string = 'list-view',
  network?: Network,
  selector: string = '*'
): ViewGadget {
  const view = new ViewGadget(id)
  
  if (network) {
    view.observeNetwork(network)
  }
  
  view.setSelector(selector)
  view.setLayout('list')
  
  return view
}

/**
 * Create a simple grid view
 */
export function createGridView(
  id: string = 'grid-view',
  network?: Network,
  selector: string = '*',
  columns: number = 3
): ViewGadget {
  const view = new ViewGadget(id)
  
  if (network) {
    view.observeNetwork(network)
  }
  
  view.setSelector(selector)
  view.setLayout('grid')
  view.setLayoutParams({
    columns,
    spacing: 10,
    cellWidth: 100,
    cellHeight: 100
  })
  
  return view
}

/**
 * Create a simple tree view
 */
export function createTreeView(
  id: string = 'tree-view',
  network?: Network,
  selector: string = '*'
): ViewGadget {
  const view = new ViewGadget(id)
  
  if (network) {
    view.observeNetwork(network)
  }
  
  view.setSelector(selector)
  view.setLayout('tree')
  view.setLayoutParams({
    indent: 20,
    spacing: 5
  })
  
  return view
}