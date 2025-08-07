/**
 * Bassline Export
 * 
 * Functions to serialize propagation networks into bassline manifests
 */

import type { 
  Group, 
  Contact, 
  Wire, 
  GroupState,
  NetworkState 
} from '@bassline/core'
import type { 
  Bassline, 
  GadgetDefinition,
  GadgetInterface,
  BasslineAttributes
} from './types'

/**
 * Export options for controlling what gets included in the bassline
 */
export interface ExportOptions {
  // Include contact values in the export
  includeValues?: boolean
  // Include only topology (no values or attributes)
  topologyOnly?: boolean
  // Generate content hash for verification
  generateHash?: boolean
  // Metadata to include
  metadata?: {
    author?: string
    description?: string
    tags?: string[]
  }
}

/**
 * Export a single group as a bassline
 */
export function exportGroupAsBassline(
  group: Group,
  state: GroupState,
  options: ExportOptions = {}
): Bassline {
  const bassline: Bassline = {
    name: group.name || group.id,
    attributes: group.attributes,
  }

  // Build topology
  const topology = {
    contacts: Array.from(state.contacts.values()).map(contact => 
      exportContact(contact, options)
    ),
    wires: Array.from(state.wires.values()).map(wire => 
      exportWire(wire, options)
    ),
    subgroups: group.subgroupIds,
  }

  // Determine if this is a gadget (has boundary contacts)
  const boundaryContacts = Array.from(state.contacts.values())
    .filter(c => group.boundaryContactIds.includes(c.id))
  
  if (boundaryContacts.length > 0) {
    // Export as a gadget with interface
    // For now, treat all boundary contacts as both input and output
    const inputs = boundaryContacts.map(c => c.id)
    const outputs = boundaryContacts.map(c => c.id)
    
    bassline.interface = {
      inputs,
      outputs,
    }

    // Check for special @ contacts (attributes, schema, etc)
    const attributeContacts = boundaryContacts
      .filter(c => c.id.startsWith('@'))
      .map(c => c.id)
    
    if (attributeContacts.length > 0) {
      bassline.interface.attributes = attributeContacts
    }
  }

  // Add build section
  bassline.build = {
    topology: topology as any // TODO: proper Topology type
  }

  // Add seeds if including values
  if (options.includeValues && !options.topologyOnly) {
    const seeds: Record<string, unknown> = {}
    for (const contact of state.contacts.values()) {
      if (contact.content !== undefined) {
        seeds[contact.id] = contact.content
      }
    }
    if (Object.keys(seeds).length > 0) {
      bassline.seeds = seeds
    }
  }

  // Add metadata
  if (options.metadata) {
    bassline.metadata = {
      ...options.metadata,
      created: new Date().toISOString(),
    }
  }

  // Generate hash if requested
  if (options.generateHash) {
    bassline.hash = generateBasslineHash(bassline)
  }

  return bassline
}

/**
 * Export an entire network state as a bassline
 */
export function exportNetworkAsBassline(
  networkState: NetworkState,
  options: ExportOptions = {}
): Bassline {
  const rootGroup = networkState.groups.get(networkState.rootGroupId)
  if (!rootGroup) {
    throw new Error('Root group not found')
  }

  // Export root group as main bassline
  const bassline = exportGroupAsBassline(
    rootGroup.group,
    rootGroup,
    options
  )

  // Export subgroups as nested gadgets
  const gadgets: GadgetDefinition[] = []
  
  for (const [groupId, groupState] of networkState.groups) {
    if (groupId === networkState.rootGroupId) continue
    
    const subBassline = exportGroupAsBassline(
      groupState.group,
      groupState,
      options
    )
    
    gadgets.push({
      id: groupId,
      type: 'normal',
      bassline: subBassline,
      attributes: groupState.group.attributes,
    })
  }

  if (gadgets.length > 0) {
    if (!bassline.build) bassline.build = {}
    bassline.build.gadgets = gadgets
  }

  return bassline
}

/**
 * Export a selection of groups/contacts/wires as a bassline
 */
export function exportSelectionAsBassline(
  selection: {
    groups?: Group[]
    contacts?: Contact[]
    wires?: Wire[]
  },
  options: ExportOptions = {}
): Bassline {
  const bassline: Bassline = {
    name: options.metadata?.description || 'selection',
  }

  const topology: any = {}

  if (selection.contacts && selection.contacts.length > 0) {
    topology.contacts = selection.contacts.map(c => 
      exportContact(c, options)
    )
  }

  if (selection.wires && selection.wires.length > 0) {
    topology.wires = selection.wires.map(w => 
      exportWire(w, options)
    )
  }

  if (selection.groups && selection.groups.length > 0) {
    topology.subgroups = selection.groups.map(g => g.id)
  }

  bassline.build = { topology }

  return bassline
}

/**
 * Export a contact
 */
function exportContact(
  contact: Contact,
  options: ExportOptions
): any {
  const exported: any = {
    id: contact.id,
    blendMode: contact.blendMode,
  }

  if (contact.name) {
    exported.name = contact.name
  }

  if (contact.isBoundary) {
    exported.isBoundary = true
    if (contact.boundaryDirection) {
      exported.boundaryDirection = contact.boundaryDirection
    }
  }

  if (!options.topologyOnly) {
    if (contact.attributes) {
      exported.attributes = contact.attributes
    }

    if (options.includeValues && contact.content !== undefined) {
      exported.content = contact.content
    }
  }

  return exported
}

/**
 * Export a wire
 */
function exportWire(
  wire: Wire,
  options: ExportOptions
): any {
  const exported: any = {
    id: wire.id,
    fromId: wire.fromId,
    toId: wire.toId,
    type: wire.type,
  }

  if (!options.topologyOnly && wire.attributes) {
    exported.attributes = wire.attributes
  }

  return exported
}

/**
 * Generate a hash for a bassline manifest
 */
function generateBasslineHash(bassline: Bassline): string {
  // Simple hash for now - in production would use proper crypto
  const str = JSON.stringify(bassline, Object.keys(bassline).sort())
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Serialize a bassline to JSON string
 */
export function serializeBassline(bassline: Bassline): string {
  return JSON.stringify(bassline, null, 2)
}

/**
 * Deserialize a bassline from JSON string
 */
export function deserializeBassline(json: string): Bassline {
  return JSON.parse(json)
}