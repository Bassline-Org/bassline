/**
 * Query System for Gadget Networks
 * 
 * A powerful, CSS-like selector system for finding and filtering gadgets
 * within networks. Only Networks (containers) are queryable - Cells and 
 * Functions are leaf nodes that can be found but not queried into.
 * 
 * ## Selector Syntax Examples:
 * 
 * Basic selectors:
 *   "Cell"                 - All gadgets of type Cell
 *   "#myId"                - Gadget with id "myId"  
 *   ".visible"             - Gadgets with metadata visible=true
 *   "*"                    - All gadgets
 * 
 * Attribute selectors:
 *   "Cell[value>5]"        - Cells with value greater than 5
 *   "Cell[value='hello']"  - Cells with value equal to "hello"
 *   "Network[size>=10]"    - Networks with 10 or more children
 * 
 * Combinators:
 *   "Network > Cell"       - Cells that are direct children of Networks
 *   "Network Cell"         - Cells that are descendants of Networks
 *   "Cell + Function"      - Functions immediately after Cells
 *   "Cell ~ Function"      - Functions that are siblings of Cells
 * 
 * Compound selectors:
 *   "Cell.active"          - Active cells
 *   "Network#main > Cell"  - Cells in the main network
 *   "Cell[value>0].visible" - Visible cells with positive values
 * 
 * ## Query Chain API:
 * 
 * Queries can be chained for complex operations:
 *   query("Cell").where(c => c.value > 5).upstream()
 *   query("*").near({x: 0, y: 0}, 100).ofType("Cell")
 */

import type { GadgetBase, Container } from './gadget-base'
import type { LatticeValue } from './lattice-types'

/**
 * Query builder for finding gadgets in networks
 */
export class Query {
  private gadgets: Set<GadgetBase>
  private root: Container | null = null
  
  constructor(initial?: Set<GadgetBase> | Container) {
    if (initial instanceof Set) {
      this.gadgets = new Set(initial)
    } else if (initial && 'query' in initial) {
      this.root = initial as Container
      this.gadgets = new Set(initial.children)
    } else {
      this.gadgets = new Set()
    }
  }
  
  // ============================================================================
  // Selector Parsing
  // ============================================================================
  
  /**
   * Parse and apply a CSS-like selector
   * 
   * @example
   * query.select("Cell")           // Type selector
   * query.select("#myId")          // ID selector
   * query.select(".active")        // Metadata selector
   * query.select("Cell[value>5]")  // Attribute selector
   * query.select("Network > Cell") // Child combinator
   */
  select(selector: string): Query {
    const trimmed = selector.trim()
    
    // Handle combinators
    if (trimmed.includes('>')) {
      return this.selectChildren(trimmed)
    }
    if (trimmed.includes(' ') && !trimmed.includes('[')) {
      return this.selectDescendants(trimmed)
    }
    if (trimmed.includes('+')) {
      return this.selectNextSibling(trimmed)
    }
    if (trimmed.includes('~')) {
      return this.selectSiblings(trimmed)
    }
    
    // Parse single selector
    return this.selectSingle(trimmed)
  }
  
  private selectSingle(selector: string): Query {
    let result = new Set<GadgetBase>()
    
    // Parse selector components
    const idMatch = selector.match(/#([^.\[]+)/)
    const typeMatch = selector.match(/^([^#.\[]+)/)
    const classMatch = selector.match(/\.([^.\[]+)/)
    const attrMatch = selector.match(/\[([^\]]+)\]/)
    
    // Start with all gadgets or current set
    let candidates = this.gadgets.size > 0 ? this.gadgets : this.getAllGadgets()
    
    // Filter by type
    if (typeMatch && typeMatch[1] !== '*') {
      const type = typeMatch[1]
      candidates = new Set(Array.from(candidates).filter(g => 
        g.type === type || g.constructor.name === type
      ))
    }
    
    // Filter by ID
    if (idMatch) {
      const id = idMatch[1]
      candidates = new Set(Array.from(candidates).filter(g => g.id === id))
    }
    
    // Filter by class (metadata)
    if (classMatch) {
      const className = classMatch[1]
      candidates = new Set(Array.from(candidates).filter(g => {
        const meta = g.getMetadata()
        return meta[className] === true
      }))
    }
    
    // Filter by attribute
    if (attrMatch) {
      candidates = this.filterByAttribute(candidates, attrMatch[1])
    }
    
    this.gadgets = candidates
    return this
  }
  
  private filterByAttribute(gadgets: Set<GadgetBase>, attrExpr: string): Set<GadgetBase> {
    // Parse attribute expression: "value > 5", "name = 'test'", etc.
    const match = attrExpr.match(/(\w+)\s*([><=!]+)\s*(.+)/)
    if (!match) return gadgets
    
    const [, attr, op, valueStr] = match
    const value = this.parseValue(valueStr.trim())
    
    return new Set(Array.from(gadgets).filter(g => {
      const gadgetValue = this.getGadgetAttribute(g, attr)
      return this.compareValues(gadgetValue, op, value)
    }))
  }
  
  private getGadgetAttribute(gadget: GadgetBase, attr: string): any {
    // Check metadata first
    const meta = gadget.getMetadata()
    if (attr in meta) return meta[attr]
    
    // Check direct properties
    if (attr in gadget) return (gadget as any)[attr]
    
    // Special case for value on cells
    if (attr === 'value' && 'getOutput' in gadget) {
      const output = (gadget as any).getOutput()
      if (output && 'value' in output) return output.value
    }
    
    // Special case for size on containers
    if (attr === 'size' && 'children' in gadget) {
      return (gadget as any).children.size
    }
    
    return undefined
  }
  
  private parseValue(str: string): any {
    // Remove quotes if present
    if ((str.startsWith('"') && str.endsWith('"')) || 
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1)
    }
    // Try to parse as number
    const num = Number(str)
    if (!isNaN(num)) return num
    // Parse booleans
    if (str === 'true') return true
    if (str === 'false') return false
    if (str === 'null') return null
    // Return as string
    return str
  }
  
  private compareValues(a: any, op: string, b: any): boolean {
    switch (op) {
      case '=':
      case '==':
        return a == b
      case '!=':
        return a != b
      case '>':
        return a > b
      case '>=':
        return a >= b
      case '<':
        return a < b
      case '<=':
        return a <= b
      default:
        return false
    }
  }
  
  // ============================================================================
  // Combinator Selectors
  // ============================================================================
  
  private selectChildren(selector: string): Query {
    const [parentSel, childSel] = selector.split('>').map(s => s.trim())
    
    // Find parents
    const parents = new Query(this.gadgets).select(parentSel).gadgets
    
    // Find direct children
    const children = new Set<GadgetBase>()
    parents.forEach(parent => {
      if ('children' in parent) {
        const container = parent as Container
        container.children.forEach(child => {
          if (this.matchesSelector(child, childSel)) {
            children.add(child)
          }
        })
      }
    })
    
    this.gadgets = children
    return this
  }
  
  private selectDescendants(selector: string): Query {
    const parts = selector.split(' ').map(s => s.trim()).filter(s => s)
    if (parts.length !== 2) return this
    
    const [ancestorSel, descendantSel] = parts
    
    // Find ancestors
    const ancestors = new Query(this.gadgets).select(ancestorSel).gadgets
    
    // Find all descendants
    const descendants = new Set<GadgetBase>()
    ancestors.forEach(ancestor => {
      if ('children' in ancestor) {
        this.collectDescendants(ancestor as Container, descendantSel, descendants)
      }
    })
    
    this.gadgets = descendants
    return this
  }
  
  private collectDescendants(container: Container, selector: string, result: Set<GadgetBase>) {
    container.children.forEach(child => {
      if (this.matchesSelector(child, selector)) {
        result.add(child)
      }
      if ('children' in child) {
        this.collectDescendants(child as Container, selector, result)
      }
    })
  }
  
  private selectNextSibling(selector: string): Query {
    // Implementation for adjacent sibling selector
    // This would require parent tracking
    console.warn('Adjacent sibling selector not yet implemented')
    return this
  }
  
  private selectSiblings(selector: string): Query {
    // Implementation for general sibling selector
    // This would require parent tracking
    console.warn('General sibling selector not yet implemented')
    return this
  }
  
  private matchesSelector(gadget: GadgetBase, selector: string): boolean {
    const q = new Query(new Set([gadget]))
    q.selectSingle(selector)
    return q.gadgets.has(gadget)
  }
  
  // ============================================================================
  // Graph Traversal
  // ============================================================================
  
  /**
   * Get upstream gadgets (gadgets that send values to these gadgets)
   * 
   * @param depth - How many levels to traverse (default: 1)
   */
  upstream(depth: number = 1): Query {
    const result = new Set<GadgetBase>()
    
    const traverse = (gadget: GadgetBase, d: number) => {
      if (d <= 0) return
      gadget.upstream.forEach(up => {
        result.add(up as unknown as GadgetBase)
        traverse(up as unknown as GadgetBase, d - 1)
      })
    }
    
    this.gadgets.forEach(g => traverse(g, depth))
    this.gadgets = result
    return this
  }
  
  /**
   * Get downstream gadgets (gadgets that receive values from these gadgets)
   * 
   * @param depth - How many levels to traverse (default: 1)
   */
  downstream(depth: number = 1): Query {
    const result = new Set<GadgetBase>()
    
    const traverse = (gadget: GadgetBase, d: number) => {
      if (d <= 0) return
      gadget.downstream.forEach(down => {
        result.add(down as unknown as GadgetBase)
        traverse(down as unknown as GadgetBase, d - 1)
      })
    }
    
    this.gadgets.forEach(g => traverse(g, depth))
    this.gadgets = result
    return this
  }
  
  /**
   * Get all connected gadgets (both upstream and downstream)
   */
  connected(): Query {
    const result = new Set<GadgetBase>()
    
    this.gadgets.forEach(g => {
      g.upstream.forEach(up => result.add(up as unknown as GadgetBase))
      g.downstream.forEach(down => result.add(down as unknown as GadgetBase))
    })
    
    this.gadgets = result
    return this
  }
  
  /**
   * Get children of container gadgets
   */
  children(): Query {
    const result = new Set<GadgetBase>()
    
    this.gadgets.forEach(g => {
      if ('children' in g) {
        const container = g as Container
        container.children.forEach(child => result.add(child))
      }
    })
    
    this.gadgets = result
    return this
  }
  
  /**
   * Get all descendants recursively
   */
  descendants(): Query {
    const result = new Set<GadgetBase>()
    
    const collectAll = (container: Container) => {
      container.children.forEach(child => {
        result.add(child)
        if ('children' in child) {
          collectAll(child as Container)
        }
      })
    }
    
    this.gadgets.forEach(g => {
      if ('children' in g) {
        collectAll(g as Container)
      }
    })
    
    this.gadgets = result
    return this
  }
  
  // ============================================================================
  // Filtering
  // ============================================================================
  
  /**
   * Filter by gadget type
   */
  ofType(type: string): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(g => 
        g.type === type || g.constructor.name === type
      )
    )
    return this
  }
  
  /**
   * Filter by ID
   */
  withId(id: string): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(g => g.id === id)
    )
    return this
  }
  
  /**
   * Filter by custom predicate
   */
  where(predicate: (gadget: GadgetBase) => boolean): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(predicate)
    )
    return this
  }
  
  /**
   * Filter by metadata
   */
  withMetadata(key: string, value?: any): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(g => {
        const meta = g.getMetadata()
        if (value === undefined) {
          return key in meta
        }
        return meta[key] === value
      })
    )
    return this
  }
  
  // ============================================================================
  // Spatial Queries (for visual gadgets)
  // ============================================================================
  
  /**
   * Find gadgets within a bounding box
   */
  within(bounds: { x: number, y: number, width: number, height: number }): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(g => {
        const meta = g.getMetadata()
        const pos = meta['position'] || meta['bounds']
        if (!pos) return false
        
        return pos.x >= bounds.x && 
               pos.x <= bounds.x + bounds.width &&
               pos.y >= bounds.y && 
               pos.y <= bounds.y + bounds.height
      })
    )
    return this
  }
  
  /**
   * Find gadgets near a point
   */
  near(point: { x: number, y: number }, radius: number): Query {
    this.gadgets = new Set(
      Array.from(this.gadgets).filter(g => {
        const meta = g.getMetadata()
        const pos = meta['position'] || meta['bounds']
        if (!pos) return false
        
        const dx = pos.x - point.x
        const dy = pos.y - point.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        return distance <= radius
      })
    )
    return this
  }
  
  // ============================================================================
  // Set Operations
  // ============================================================================
  
  /**
   * Union with another query
   */
  or(other: Query): Query {
    other.gadgets.forEach(g => this.gadgets.add(g))
    return this
  }
  
  /**
   * Intersection with another query
   */
  and(other: Query): Query {
    const intersection = new Set<GadgetBase>()
    this.gadgets.forEach(g => {
      if (other.gadgets.has(g)) {
        intersection.add(g)
      }
    })
    this.gadgets = intersection
    return this
  }
  
  /**
   * Exclude gadgets from another query
   */
  not(other: Query): Query {
    other.gadgets.forEach(g => this.gadgets.delete(g))
    return this
  }
  
  // ============================================================================
  // Execution
  // ============================================================================
  
  /**
   * Execute the query and return results
   */
  execute(): Set<GadgetBase> {
    return new Set(this.gadgets)
  }
  
  /**
   * Get results as array
   */
  toArray(): GadgetBase[] {
    return Array.from(this.gadgets)
  }
  
  /**
   * Get first result
   */
  first(): GadgetBase | null {
    return this.gadgets.values().next().value || null
  }
  
  /**
   * Get count
   */
  count(): number {
    return this.gadgets.size
  }
  
  /**
   * Check if any results
   */
  any(): boolean {
    return this.gadgets.size > 0
  }
  
  /**
   * Iterate over results
   */
  forEach(callback: (gadget: GadgetBase, index: number) => void): void {
    Array.from(this.gadgets).forEach(callback)
  }
  
  /**
   * Map over results
   */
  map<T>(callback: (gadget: GadgetBase, index: number) => T): T[] {
    return Array.from(this.gadgets).map(callback)
  }
  
  // ============================================================================
  // Helpers
  // ============================================================================
  
  private getAllGadgets(): Set<GadgetBase> {
    // If we have a root, get all its descendants
    if (this.root) {
      const all = new Set<GadgetBase>()
      const collectAll = (container: Container) => {
        container.children.forEach(child => {
          all.add(child)
          if ('children' in child) {
            collectAll(child as Container)
          }
        })
      }
      collectAll(this.root)
      return all
    }
    
    // Otherwise return empty set
    return new Set()
  }
}

/**
 * Create a new query
 */
export function query(selector?: string): Query
export function query(container: Container, selector?: string): Query
export function query(arg1?: string | Container, arg2?: string): Query {
  if (typeof arg1 === 'string') {
    return new Query().select(arg1)
  } else if (arg1 && 'query' in arg1) {
    const q = new Query(arg1 as Container)
    if (arg2) {
      return q.select(arg2)
    }
    return q
  }
  return new Query()
}