/**
 * Dynamic Bassline Gadget
 * 
 * A primitive gadget that dynamically injects a bassline structure into the runtime.
 * Creates live bindings between the inner network and outer contacts.
 * 
 * Inputs:
 * - bassline: The Bassline structure to inject
 * - Any mapped inputs from outer contacts
 * 
 * Outputs:
 * - Any mapped outputs to outer contacts
 */

import {
  PrimitiveGadget,
  Bassline,
  ContactId,
  WireId,
  GroupId,
  ReifiedContact,
  ReifiedWire,
  ReifiedGroup
} from './types'

export interface DynamicBasslineConfig {
  /**
   * Maps outer boundary contact names to inner contact IDs
   * e.g., { 'input-a': 'inner-contact-1' }
   */
  inputMapping?: Record<string, ContactId>
  
  /**
   * Maps inner contact IDs to outer boundary contact names
   * e.g., { 'inner-result': 'output-sum' }
   */
  outputMapping?: Record<ContactId, string>
}

/**
 * Creates a Dynamic Bassline Gadget.
 * This gadget injects a bassline structure into the runtime and sets up
 * wires to connect the inner and outer networks.
 * 
 * @param config Configuration for input/output mappings
 * @param getRuntimeBassline Function to get current runtime bassline
 * @param applyStructureChanges Function to apply structure changes to runtime
 * @param getOuterContactId Function to resolve boundary name to actual contact ID
 */
export function createDynamicBasslineGadget(
  config: DynamicBasslineConfig = {},
  getRuntimeBassline: () => Bassline,
  applyStructureChanges: (changes: StructureChanges) => void,
  getOuterContactId: (boundaryName: string) => ContactId | undefined,
  getRuntimeValue?: (contactId: ContactId) => any
): PrimitiveGadget {
  let currentInjectedStructure: InjectedStructure | null = null
  let contactIdMap: Map<ContactId, ContactId> | null = null
  
  return {
    type: 'dynamic-bassline',
    inputs: ['bassline', ...(Object.keys(config.inputMapping || {}))],
    outputs: Object.keys(config.outputMapping || {}),
    
    activation(inputs: Map<string, any>): boolean {
      // Activate when we have a bassline to inject
      return inputs.has('bassline')
    },
    
    execute(inputs: Map<string, any>): Map<string, any> {
      const outputs = new Map<string, any>()
      const bassline = inputs.get('bassline') as Bassline
      
      if (!bassline) {
        // No bassline, clean up if needed
        if (currentInjectedStructure) {
          cleanup()
        }
        return outputs
      }
      
      // Check if bassline structure changed
      if (currentInjectedStructure && !basslineStructureEqual(currentInjectedStructure.bassline, bassline)) {
        // Structure changed, clean up old and inject new
        cleanup()
      }
      
      // Inject structure if not already injected
      if (!currentInjectedStructure) {
        const result = injectStructure(bassline)
        currentInjectedStructure = result.structure
        contactIdMap = result.contactIdMap
      }
      
      // Update input values through connecting wires
      if (config.inputMapping) {
        for (const [outerName, innerId] of Object.entries(config.inputMapping)) {
          if (inputs.has(outerName)) {
            // The input values will propagate through the wires we created
            // during structure injection
          }
        }
      }
      
      // Read output values from the inner network
      if (config.outputMapping && contactIdMap) {
        for (const [innerId, outerName] of Object.entries(config.outputMapping)) {
          // Map the inner ID to the actual injected contact ID
          const mappedInnerId = contactIdMap.get(innerId)
          
          if (mappedInnerId) {
            // Get value from runtime if function provided, otherwise from bassline
            const value = getRuntimeValue ? 
              getRuntimeValue(mappedInnerId) :
              getRuntimeBassline().contacts.get(mappedInnerId)?.content
              
            outputs.set(outerName, value !== undefined ? value : null)
          } else {
            outputs.set(outerName, null)
          }
        }
      }
      
      return outputs
    }
  }
  
  function injectStructure(bassline: Bassline): { structure: InjectedStructure, contactIdMap: Map<ContactId, ContactId> } {
    const injected: InjectedStructure = {
      bassline,
      contactIds: new Set<ContactId>(),
      wireIds: new Set<WireId>(),
      groupIds: new Set<GroupId>(),
      mappingWireIds: new Set<WireId>()
    }
    
    // Generate unique prefixes to avoid ID collisions
    const prefix = `dyn_${Date.now()}_`
    
    // Map old IDs to new IDs
    const contactIdMap = new Map<ContactId, ContactId>()
    const groupIdMap = new Map<GroupId, GroupId>()
    
    // Inject contacts with prefixed IDs
    const contactsToAdd = new Map<ContactId, ReifiedContact>()
    for (const [oldId, contact] of bassline.contacts) {
      const newId = prefix + oldId
      contactIdMap.set(oldId, newId)
      injected.contactIds.add(newId)
      
      contactsToAdd.set(newId, {
        ...contact,
        groupId: contact.groupId ? prefix + contact.groupId : undefined
      })
    }
    
    // Inject groups with prefixed IDs
    const groupsToAdd = new Map<GroupId, ReifiedGroup>()
    for (const [oldId, group] of bassline.groups) {
      const newId = prefix + oldId
      groupIdMap.set(oldId, newId)
      injected.groupIds.add(newId)
      
      // Map contact IDs in the group
      const newContactIds = new Set<ContactId>()
      for (const contactId of group.contactIds) {
        newContactIds.add(contactIdMap.get(contactId) || contactId)
      }
      
      const newBoundaryIds = new Set<ContactId>()
      for (const contactId of group.boundaryContactIds) {
        newBoundaryIds.add(contactIdMap.get(contactId) || contactId)
      }
      
      groupsToAdd.set(newId, {
        ...group,
        contactIds: newContactIds,
        boundaryContactIds: newBoundaryIds,
        parentId: group.parentId ? groupIdMap.get(group.parentId) : undefined
      })
    }
    
    // Inject wires with mapped contact IDs
    const wiresToAdd = new Map<WireId, ReifiedWire>()
    for (const [oldWireId, wire] of bassline.wires) {
      const newWireId = prefix + oldWireId
      injected.wireIds.add(newWireId)
      
      wiresToAdd.set(newWireId, {
        fromId: contactIdMap.get(wire.fromId) || wire.fromId,
        toId: contactIdMap.get(wire.toId) || wire.toId,
        properties: wire.properties
      })
    }
    
    // Create mapping wires between outer and inner contacts
    const mappingWiresToAdd = new Map<WireId, ReifiedWire>()
    
    // Input mappings: create wires from outer to inner
    if (config.inputMapping) {
      for (const [outerName, innerId] of Object.entries(config.inputMapping)) {
        const outerContactId = getOuterContactId(outerName)
        if (!outerContactId) {
          console.warn(`Could not find outer contact for boundary name: ${outerName}`)
          continue
        }
        
        const wireId = `${prefix}input_wire_${outerName}`
        const mappedInnerId = contactIdMap.get(innerId) || innerId
        
        injected.mappingWireIds.add(wireId)
        mappingWiresToAdd.set(wireId, {
          fromId: outerContactId,
          toId: mappedInnerId,
          properties: { bidirectional: false }
        })
      }
    }
    
    // Output mappings: create wires from inner to outer
    if (config.outputMapping) {
      for (const [innerId, outerName] of Object.entries(config.outputMapping)) {
        const outerContactId = getOuterContactId(outerName)
        if (!outerContactId) {
          console.warn(`Could not find outer contact for boundary name: ${outerName}`)
          continue
        }
        
        const wireId = `${prefix}output_wire_${outerName}`
        const mappedInnerId = contactIdMap.get(innerId) || innerId
        
        injected.mappingWireIds.add(wireId)
        mappingWiresToAdd.set(wireId, {
          fromId: mappedInnerId,
          toId: outerContactId,
          properties: { bidirectional: false }
        })
      }
    }
    
    // Apply all the structure changes
    applyStructureChanges({
      contactsToAdd,
      wiresToAdd,
      groupsToAdd,
      mappingWiresToAdd,
      contactsToRemove: new Set(),
      wiresToRemove: new Set(),
      groupsToRemove: new Set()
    })
    
    return { structure: injected, contactIdMap }
  }
  
  function cleanup() {
    if (!currentInjectedStructure) return
    
    // Remove all injected structure
    applyStructureChanges({
      contactsToAdd: new Map(),
      wiresToAdd: new Map(),
      groupsToAdd: new Map(),
      mappingWiresToAdd: new Map(),
      contactsToRemove: currentInjectedStructure.contactIds,
      wiresToRemove: new Set([...currentInjectedStructure.wireIds, ...currentInjectedStructure.mappingWireIds]),
      groupsToRemove: currentInjectedStructure.groupIds
    })
    
    currentInjectedStructure = null
    contactIdMap = null
  }
  
  function basslineStructureEqual(a: Bassline, b: Bassline): boolean {
    // Proper structural equality check
    
    // Check contacts
    if (a.contacts.size !== b.contacts.size) return false
    for (const [id, contactA] of a.contacts) {
      const contactB = b.contacts.get(id)
      if (!contactB) return false
      // Compare relevant properties
      if (contactA.content !== contactB.content) return false
      if (contactA.groupId !== contactB.groupId) return false
      if (JSON.stringify(contactA.properties) !== JSON.stringify(contactB.properties)) return false
    }
    
    // Check wires
    if (a.wires.size !== b.wires.size) return false
    for (const [id, wireA] of a.wires) {
      const wireB = b.wires.get(id)
      if (!wireB) return false
      if (wireA.fromId !== wireB.fromId) return false
      if (wireA.toId !== wireB.toId) return false
      if (JSON.stringify(wireA.properties) !== JSON.stringify(wireB.properties)) return false
    }
    
    // Check groups
    if (a.groups.size !== b.groups.size) return false
    for (const [id, groupA] of a.groups) {
      const groupB = b.groups.get(id)
      if (!groupB) return false
      if (groupA.parentId !== groupB.parentId) return false
      if (groupA.primitiveType !== groupB.primitiveType) return false
      // Compare sets
      if (groupA.contactIds.size !== groupB.contactIds.size) return false
      for (const contactId of groupA.contactIds) {
        if (!groupB.contactIds.has(contactId)) return false
      }
      if (groupA.boundaryContactIds.size !== groupB.boundaryContactIds.size) return false
      for (const contactId of groupA.boundaryContactIds) {
        if (!groupB.boundaryContactIds.has(contactId)) return false
      }
      if (JSON.stringify(groupA.properties) !== JSON.stringify(groupB.properties)) return false
    }
    
    return true
  }
}

interface InjectedStructure {
  bassline: Bassline
  contactIds: Set<ContactId>
  wireIds: Set<WireId>
  groupIds: Set<GroupId>
  mappingWireIds: Set<WireId>
}

export interface StructureChanges {
  contactsToAdd: Map<ContactId, ReifiedContact>
  wiresToAdd: Map<WireId, ReifiedWire>
  groupsToAdd: Map<GroupId, ReifiedGroup>
  mappingWiresToAdd: Map<WireId, ReifiedWire>
  contactsToRemove: Set<ContactId>
  wiresToRemove: Set<WireId>
  groupsToRemove: Set<GroupId>
}

/**
 * Creates a self-modifying Dynamic Bassline Gadget.
 * This variant can modify its own bassline based on inputs.
 */
export function createSelfModifyingBasslineGadget(
  config: DynamicBasslineConfig & {
    /**
     * Function to transform the bassline based on inputs
     */
    transformBassline?: (bassline: Bassline, inputs: Map<string, any>) => Bassline
  },
  getRuntimeBassline: () => Bassline,
  applyStructureChanges: (changes: StructureChanges) => void,
  getOuterContactId: (boundaryName: string) => ContactId | undefined
): PrimitiveGadget {
  const baseGadget = createDynamicBasslineGadget(config, getRuntimeBassline, applyStructureChanges, getOuterContactId)
  
  return {
    ...baseGadget,
    type: 'self-modifying-bassline',
    
    execute(inputs: Map<string, any>): Map<string, any> {
      let bassline = inputs.get('bassline') as Bassline
      
      // Transform the bassline if a transformer is provided
      if (config.transformBassline && bassline) {
        bassline = config.transformBassline(bassline, inputs)
        inputs.set('bassline', bassline)
      }
      
      // Execute the base gadget with potentially modified bassline
      return baseGadget.execute(inputs)
    }
  }
}