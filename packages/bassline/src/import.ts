/**
 * Bassline Import
 * 
 * Functions to build propagation networks from bassline manifests
 */

import type { 
  Group, 
  Contact, 
  Wire,
  PropagationNetworkScheduler
} from '@bassline/core'
import type { 
  Bassline,
  GadgetDefinition,
  BasslineAttributes
} from './types'
import { 
  hasDynamicAttributes,
  hasDynamicTopology,
  createDynamicMonitor 
} from './dynamic'

/**
 * Import options for controlling how basslines are instantiated
 */
export interface ImportOptions {
  // Parent group to import into (default: root)
  parentGroupId?: string
  // Apply seed values from the bassline
  applySeeds?: boolean
  // Validate the bassline before importing
  validate?: boolean
  // Prefix for imported IDs to avoid conflicts
  idPrefix?: string
  // How to handle existing IDs
  conflictStrategy?: 'error' | 'rename' | 'merge'
}

/**
 * Import result containing created entities
 */
export interface ImportResult {
  // Created groups
  groups: Group[]
  // Created contacts
  contacts: Contact[]
  // Created wires
  wires: Wire[]
  // ID mapping from bassline IDs to actual IDs
  idMap: Map<string, string>
  // Any warnings during import
  warnings?: string[]
}

/**
 * Import a bassline into a network
 */
export async function importBassline(
  bassline: Bassline,
  scheduler: PropagationNetworkScheduler,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const result: ImportResult = {
    groups: [],
    contacts: [],
    wires: [],
    idMap: new Map(),
    warnings: [],
  }

  // Validate if requested
  if (options.validate) {
    const validation = validateBasslineForImport(bassline)
    if (!validation.valid) {
      throw new Error(`Invalid bassline: ${validation.errors?.join(', ')}`)
    }
    if (validation.warnings) {
      result.warnings = validation.warnings
    }
  }

  const parentGroupId = options.parentGroupId || 'root'

  // Import based on what the bassline contains
  if (bassline.build?.topology) {
    await importTopology(
      bassline.build.topology,
      parentGroupId,
      scheduler,
      result,
      options
    )
  }

  if (bassline.build?.gadget) {
    await importGadget(
      bassline.build.gadget,
      parentGroupId,
      scheduler,
      result,
      options
    )
  }

  if (bassline.build?.gadgets) {
    for (const gadget of bassline.build.gadgets) {
      await importGadget(
        gadget,
        parentGroupId,
        scheduler,
        result,
        options
      )
    }
  }

  // Apply seeds if requested
  if (options.applySeeds && bassline.seeds) {
    await applySeeds(bassline.seeds, result.idMap, scheduler)
  }

  // Set up dynamic monitoring for groups with dynamic features
  for (const group of result.groups) {
    if (group.attributes) {
      if (hasDynamicAttributes(group) || hasDynamicTopology(group)) {
        // Start monitoring this group for dynamic changes
        createDynamicMonitor(group.id, scheduler)
        
        if (result.warnings) {
          result.warnings.push(`Group ${group.name || group.id} has dynamic features enabled`)
        } else {
          result.warnings = [`Group ${group.name || group.id} has dynamic features enabled`]
        }
      }
    }
  }

  return result
}

/**
 * Import a topology
 */
async function importTopology(
  topology: any,
  parentGroupId: string,
  scheduler: PropagationNetworkScheduler,
  result: ImportResult,
  options: ImportOptions
): Promise<void> {
  // Create a group for this topology if it has subgroups
  let groupId = parentGroupId
  
  if (topology.subgroups && topology.subgroups.length > 0) {
    const group = await scheduler.addGroup(parentGroupId, {
      name: 'imported-group',
      attributes: topology.attributes,
    })
    groupId = group
    result.groups.push({ 
      id: group,
      name: 'imported-group',
      parentId: parentGroupId,
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      attributes: topology.attributes,
    })
  }

  // Import contacts
  if (topology.contacts) {
    for (const contactDef of topology.contacts) {
      const basslineId = contactDef.id
      const actualId = await importContact(
        contactDef,
        groupId,
        scheduler,
        options
      )
      
      result.idMap.set(basslineId, actualId)
      result.contacts.push({
        id: actualId,
        groupId,
        blendMode: contactDef.blendMode || 'accept-last',
        isBoundary: contactDef.isBoundary,
        boundaryDirection: contactDef.boundaryDirection,
        name: contactDef.name,
        attributes: contactDef.attributes,
        content: contactDef.content,
      })
    }
  }

  // Import wires (after contacts so IDs are mapped)
  if (topology.wires) {
    for (const wireDef of topology.wires) {
      const fromId = result.idMap.get(wireDef.fromId) || wireDef.fromId
      const toId = result.idMap.get(wireDef.toId) || wireDef.toId
      
      const wireId = await scheduler.connect(
        fromId,
        toId,
        wireDef.type || 'bidirectional'
      )
      
      result.wires.push({
        id: wireId,
        groupId,
        fromId,
        toId,
        type: wireDef.type || 'bidirectional',
        attributes: wireDef.attributes,
      })
    }
  }
}

/**
 * Import a gadget
 */
async function importGadget(
  gadget: GadgetDefinition,
  parentGroupId: string,
  scheduler: PropagationNetworkScheduler,
  result: ImportResult,
  options: ImportOptions
): Promise<void> {
  // Handle different gadget types
  if (gadget.type === 'primitive' && gadget.variant) {
    // Create a primitive gadget group
    const groupId = await scheduler.addGroup(parentGroupId, {
      name: gadget.id,
      primitive: {
        id: gadget.id,
        name: gadget.id,
        inputs: gadget.interface?.inputs || [],
        outputs: gadget.interface?.outputs || [],
        activation: () => true, // TODO: get from primitive registry
        body: async () => new Map(), // TODO: get from primitive registry
      },
      attributes: gadget.attributes,
    })
    
    result.groups.push({
      id: groupId,
      name: gadget.id,
      parentId: parentGroupId,
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      attributes: gadget.attributes,
    })
    
    result.idMap.set(gadget.id, groupId)
  } else if (gadget.bassline) {
    // Recursively import nested bassline
    const nested = await importBassline(
      gadget.bassline,
      scheduler,
      { ...options, parentGroupId }
    )
    
    // Merge results
    result.groups.push(...nested.groups)
    result.contacts.push(...nested.contacts)
    result.wires.push(...nested.wires)
    nested.idMap.forEach((v, k) => result.idMap.set(k, v))
    if (nested.warnings) {
      result.warnings?.push(...nested.warnings)
    }
  } else if (gadget.topology) {
    // Import gadget topology
    await importTopology(
      gadget.topology,
      parentGroupId,
      scheduler,
      result,
      options
    )
  }
}

/**
 * Import a contact
 */
async function importContact(
  contactDef: any,
  groupId: string,
  scheduler: PropagationNetworkScheduler,
  options: ImportOptions
): Promise<string> {
  const contact: Omit<Contact, 'id'> = {
    groupId,
    blendMode: contactDef.blendMode || 'accept-last',
    isBoundary: contactDef.isBoundary,
    boundaryDirection: contactDef.boundaryDirection,
    name: contactDef.name,
    attributes: contactDef.attributes,
    content: contactDef.content,
  }

  // Apply ID prefix if specified
  const contactId = await scheduler.addContact(groupId, contact)
  
  return contactId
}

/**
 * Apply seed values to contacts
 */
async function applySeeds(
  seeds: Record<string, unknown>,
  idMap: Map<string, string>,
  scheduler: PropagationNetworkScheduler
): Promise<void> {
  for (const [basslineId, value] of Object.entries(seeds)) {
    const actualId = idMap.get(basslineId)
    if (actualId) {
      await scheduler.scheduleUpdate(actualId, value)
    }
  }
}

/**
 * Validate a bassline for import
 */
function validateBasslineForImport(bassline: Bassline): {
  valid: boolean
  errors?: string[]
  warnings?: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!bassline.name) {
    errors.push('Bassline must have a name')
  }

  // Check that it has something to build
  if (!bassline.build) {
    errors.push('Bassline must have a build section')
  } else {
    const { topology, gadget, gadgets } = bassline.build
    if (!topology && !gadget && !gadgets) {
      errors.push('Bassline build must contain topology, gadget, or gadgets')
    }
  }

  // Check for deprecated patterns
  const attrs = bassline.attributes
  if (attrs) {
    for (const key of Object.keys(attrs)) {
      if (!key.includes('.') && !key.startsWith('x-')) {
        warnings.push(`Attribute "${key}" should be namespaced (e.g., "bassline.${key}")`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}

/**
 * Create a group from a bassline (convenience function)
 */
export async function createGroupFromBassline(
  bassline: Bassline,
  scheduler: PropagationNetworkScheduler,
  parentGroupId: string = 'root'
): Promise<string> {
  const result = await importBassline(bassline, scheduler, {
    parentGroupId,
    applySeeds: true,
  })
  
  // Return the first created group ID
  if (result.groups.length > 0) {
    return result.groups[0].id
  }
  
  throw new Error('No groups created from bassline')
}