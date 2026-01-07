/**
 * Vocabulary Parser
 *
 * Parses vocabulary stamps (stamps with kind='vocabulary') into structured definitions.
 * Vocabulary stamps define what roles, attrs, and ports are available.
 *
 * Example stamp attrs:
 * ```
 * vocab.defines: role
 * vocab.value: cell
 * vocab.label: Cell
 * vocab.description: Lattice-based state
 *
 * vocab.attr.lattice.type: select
 * vocab.attr.lattice.label: Lattice
 * vocab.attr.lattice.required: true
 * vocab.attr.lattice.options: maxNumber,minNumber,setUnion,lww,boolean,object
 *
 * vocab.port.get: bidirectional
 * vocab.port.put: bidirectional
 *
 * visual.shape: circle
 * visual.fill: #2a4a7a
 * ```
 */

import type { StampWithAttrs } from '../types'

/** Types of vocabulary items */
export type VocabularyKind = 'role' | 'lattice' | 'shape'

/** Attribute editor types */
export type AttrType = 'string' | 'number' | 'boolean' | 'select' | 'color' | 'path'

/** Port direction */
export type PortDirection = 'input' | 'output' | 'bidirectional'

/** Definition of an attribute that a role supports */
export interface AttrDefinition {
  key: string
  type: AttrType
  label: string
  description?: string
  required?: boolean
  options?: string[]   // For select type
  default?: string     // Default value
  placeholder?: string
}

/** Definition of a port that a role supports */
export interface PortDefinition {
  name: string
  direction: PortDirection
  label?: string
  description?: string
}

/** A parsed vocabulary item */
export interface VocabularyItem {
  id: string           // Stamp ID
  kind: VocabularyKind // What this defines (role, lattice, shape)
  value: string        // The value (e.g., "cell", "maxNumber")
  label: string        // Human-readable label
  description?: string
  icon?: string        // Icon name (for shapes/roles)
  attrs: AttrDefinition[]    // For roles: what attrs they support
  ports: PortDefinition[]    // For roles: what ports they support
  defaults: Record<string, string> // Default attr values (visual.*, etc.)
}

/** Full vocabulary - organized by kind */
export interface Vocabulary {
  roles: VocabularyItem[]
  lattices: VocabularyItem[]
  shapes: VocabularyItem[]
}

/**
 * Parse a vocabulary stamp's attrs into a VocabularyItem
 */
export function parseVocabularyStamp(stamp: StampWithAttrs): VocabularyItem | null {
  const attrs = stamp.attrs

  // Check if this is a vocabulary stamp
  if (!attrs['vocab.defines'] || !attrs['vocab.value']) {
    return null
  }

  const kind = attrs['vocab.defines'] as VocabularyKind
  const value = attrs['vocab.value']
  const label = attrs['vocab.label'] || value
  const description = attrs['vocab.description']
  const icon = attrs['vocab.icon']

  // Parse vocab.attr.* entries
  const attrDefs: AttrDefinition[] = []
  const attrKeys = new Set<string>()

  // First pass: collect all attr keys
  for (const key of Object.keys(attrs)) {
    if (key.startsWith('vocab.attr.')) {
      // vocab.attr.{attrName}.{prop}
      const rest = key.slice('vocab.attr.'.length)
      const attrName = rest.split('.')[0]
      attrKeys.add(attrName)
    }
  }

  // Second pass: build AttrDefinition for each
  for (const attrName of attrKeys) {
    const prefix = `vocab.attr.${attrName}.`
    const def: AttrDefinition = {
      key: attrName,
      type: (attrs[`${prefix}type`] as AttrType) || 'string',
      label: attrs[`${prefix}label`] || attrName,
      description: attrs[`${prefix}description`],
      required: attrs[`${prefix}required`] === 'true',
      default: attrs[`${prefix}default`],
      placeholder: attrs[`${prefix}placeholder`],
    }

    // Handle options for select type
    const optionsStr = attrs[`${prefix}options`]
    if (optionsStr) {
      def.options = optionsStr.split(',').map(s => s.trim())
    }

    attrDefs.push(def)
  }

  // Parse vocab.port.* entries
  const portDefs: PortDefinition[] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('vocab.port.')) {
      const portName = key.slice('vocab.port.'.length)
      // Value can be: input, output, bidirectional, or a JSON object
      let direction: PortDirection = 'bidirectional'
      let label: string | undefined
      let description: string | undefined

      if (value === 'input' || value === 'output' || value === 'bidirectional') {
        direction = value
      } else {
        // Try parsing as JSON for more complex definitions
        try {
          const parsed = JSON.parse(value)
          direction = parsed.direction || 'bidirectional'
          label = parsed.label
          description = parsed.description
        } catch {
          // Not JSON, use as direction
          direction = 'bidirectional'
        }
      }

      portDefs.push({
        name: portName,
        direction,
        label,
        description,
      })
    }
  }

  // Collect defaults (non-vocab attrs)
  const defaults: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (!key.startsWith('vocab.') && value) {
      defaults[key] = value
    }
  }

  return {
    id: stamp.id,
    kind,
    value,
    label,
    description,
    icon,
    attrs: attrDefs,
    ports: portDefs,
    defaults,
  }
}

/**
 * Parse all vocabulary stamps into a structured Vocabulary
 */
export function parseVocabulary(stamps: StampWithAttrs[]): Vocabulary {
  const vocabulary: Vocabulary = {
    roles: [],
    lattices: [],
    shapes: [],
  }

  for (const stamp of stamps) {
    if (stamp.kind !== 'vocabulary') continue

    const item = parseVocabularyStamp(stamp)
    if (!item) continue

    switch (item.kind) {
      case 'role':
        vocabulary.roles.push(item)
        break
      case 'lattice':
        vocabulary.lattices.push(item)
        break
      case 'shape':
        vocabulary.shapes.push(item)
        break
    }
  }

  // Sort each by label
  vocabulary.roles.sort((a, b) => a.label.localeCompare(b.label))
  vocabulary.lattices.sort((a, b) => a.label.localeCompare(b.label))
  vocabulary.shapes.sort((a, b) => a.label.localeCompare(b.label))

  return vocabulary
}

/**
 * Get the vocabulary definition for a specific role
 */
export function getRoleVocabulary(vocabulary: Vocabulary, roleValue: string): VocabularyItem | undefined {
  return vocabulary.roles.find(r => r.value === roleValue)
}

/**
 * Merge vocabulary with built-in defaults
 * Useful when some vocabulary stamps may not exist
 */
export function mergeWithDefaults(vocabulary: Vocabulary): Vocabulary {
  // Built-in roles (used if no vocabulary stamps define them)
  const builtInRoles: VocabularyItem[] = [
    { id: '_builtin_resource', kind: 'role', value: 'resource', label: 'Resource', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_cell', kind: 'role', value: 'cell', label: 'Cell', attrs: [
      { key: 'lattice', type: 'select', label: 'Lattice', required: true, options: ['maxNumber', 'minNumber', 'setUnion', 'lww', 'boolean', 'object'] }
    ], ports: [
      { name: 'get', direction: 'bidirectional' },
      { name: 'put', direction: 'bidirectional' },
      { name: 'changed', direction: 'output' },
    ], defaults: { 'visual.shape': 'circle' } },
    { id: '_builtin_propagator', kind: 'role', value: 'propagator', label: 'Propagator', attrs: [], ports: [
      { name: 'in', direction: 'input' },
      { name: 'out', direction: 'output' },
    ], defaults: { 'visual.shape': 'diamond' } },
    { id: '_builtin_fn', kind: 'role', value: 'fn', label: 'Function', attrs: [], ports: [
      { name: 'call', direction: 'input' },
    ], defaults: { 'visual.shape': 'rounded' } },
    { id: '_builtin_store', kind: 'role', value: 'store', label: 'Store', attrs: [], ports: [
      { name: 'get', direction: 'bidirectional' },
      { name: 'put', direction: 'bidirectional' },
    ], defaults: { 'visual.shape': 'rect' } },
    { id: '_builtin_timer', kind: 'role', value: 'timer', label: 'Timer', attrs: [
      { key: 'config.interval', type: 'number', label: 'Interval (ms)', placeholder: '1000' }
    ], ports: [
      { name: 'tick', direction: 'output' },
    ], defaults: { 'visual.shape': 'circle' } },
    { id: '_builtin_plumber', kind: 'role', value: 'plumber', label: 'Plumber', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_circuit', kind: 'role', value: 'circuit', label: 'Circuit', attrs: [], ports: [], defaults: { 'visual.shape': 'rounded' } },
  ]

  const builtInLattices: VocabularyItem[] = [
    { id: '_builtin_lat_max', kind: 'lattice', value: 'maxNumber', label: 'Max Number ↑', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_lat_min', kind: 'lattice', value: 'minNumber', label: 'Min Number ↓', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_lat_set', kind: 'lattice', value: 'setUnion', label: 'Set Union ∪', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_lat_lww', kind: 'lattice', value: 'lww', label: 'Last Writer Wins', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_lat_bool', kind: 'lattice', value: 'boolean', label: 'Boolean ∨', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_lat_obj', kind: 'lattice', value: 'object', label: 'Object Merge', attrs: [], ports: [], defaults: {} },
  ]

  const builtInShapes: VocabularyItem[] = [
    { id: '_builtin_shape_rounded', kind: 'shape', value: 'rounded', label: 'Rounded', icon: 'box', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_shape_rect', kind: 'shape', value: 'rect', label: 'Rectangle', icon: 'square', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_shape_circle', kind: 'shape', value: 'circle', label: 'Circle', icon: 'circle', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_shape_diamond', kind: 'shape', value: 'diamond', label: 'Diamond', icon: 'diamond', attrs: [], ports: [], defaults: {} },
    { id: '_builtin_shape_hexagon', kind: 'shape', value: 'hexagon', label: 'Hexagon', icon: 'hexagon', attrs: [], ports: [], defaults: {} },
  ]

  // Merge: user-defined vocabulary takes precedence
  const existingRoleValues = new Set(vocabulary.roles.map(r => r.value))
  const existingLatticeValues = new Set(vocabulary.lattices.map(l => l.value))
  const existingShapeValues = new Set(vocabulary.shapes.map(s => s.value))

  return {
    roles: [
      ...vocabulary.roles,
      ...builtInRoles.filter(r => !existingRoleValues.has(r.value)),
    ],
    lattices: [
      ...vocabulary.lattices,
      ...builtInLattices.filter(l => !existingLatticeValues.has(l.value)),
    ],
    shapes: [
      ...vocabulary.shapes,
      ...builtInShapes.filter(s => !existingShapeValues.has(s.value)),
    ],
  }
}
