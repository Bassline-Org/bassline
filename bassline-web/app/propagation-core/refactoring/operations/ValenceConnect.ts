import type { ContactGroup } from '../../models/ContactGroup'
import type { Contact } from '../../models/Contact'
import type { GroupId, ContactId } from '../../types'

export interface ValenceConnectionResult {
  success: boolean
  message?: string
  connectionCount?: number
}

export class ValenceConnectOperation {
  /**
   * Check if two gadgets are valence-compatible
   * Two gadgets can connect if:
   * 1. One has N outputs and the other has N inputs (where N > 0)
   * 2. They are different gadgets
   */
  static areValenceCompatible(gadget1: ContactGroup, gadget2: ContactGroup): boolean {
    if (gadget1.id === gadget2.id) return false
    
    const g1Boundary = gadget1.getBoundaryContacts()
    const g2Boundary = gadget2.getBoundaryContacts()
    
    // Check if gadget1's outputs match gadget2's inputs
    if (g1Boundary.outputs.length > 0 && g1Boundary.outputs.length === g2Boundary.inputs.length) {
      return true
    }
    
    // Check if gadget2's outputs match gadget1's inputs
    if (g2Boundary.outputs.length > 0 && g2Boundary.outputs.length === g1Boundary.inputs.length) {
      return true
    }
    
    return false
  }
  
  /**
   * Connect two valence-compatible gadgets
   * Connects all outputs from the source gadget to all inputs of the target gadget
   * in order (by Y position, top to bottom)
   */
  execute(parentGroup: ContactGroup, gadget1Id: GroupId, gadget2Id: GroupId): ValenceConnectionResult {
    const gadget1 = parentGroup.subgroups.get(gadget1Id)
    const gadget2 = parentGroup.subgroups.get(gadget2Id)
    
    if (!gadget1 || !gadget2) {
      return { success: false, message: 'One or both gadgets not found' }
    }
    
    if (!ValenceConnectOperation.areValenceCompatible(gadget1, gadget2)) {
      return { success: false, message: 'Gadgets are not valence-compatible' }
    }
    
    const g1Boundary = gadget1.getBoundaryContacts()
    const g2Boundary = gadget2.getBoundaryContacts()
    
    let sourceOutputs: Contact[]
    let targetInputs: Contact[]
    
    // Determine connection direction
    if (g1Boundary.outputs.length > 0 && g1Boundary.outputs.length === g2Boundary.inputs.length) {
      sourceOutputs = g1Boundary.outputs
      targetInputs = g2Boundary.inputs
    } else {
      sourceOutputs = g2Boundary.outputs
      targetInputs = g1Boundary.inputs
    }
    
    // Sort by Y position (top to bottom)
    sourceOutputs.sort((a, b) => a.position.y - b.position.y)
    targetInputs.sort((a, b) => a.position.y - b.position.y)
    
    // Connect them in order
    let connectionCount = 0
    for (let i = 0; i < sourceOutputs.length; i++) {
      try {
        parentGroup.connect(sourceOutputs[i].id, targetInputs[i].id)
        connectionCount++
      } catch (error) {
        console.warn(`Failed to connect ${sourceOutputs[i].id} to ${targetInputs[i].id}:`, error)
      }
    }
    
    return { 
      success: connectionCount > 0, 
      message: connectionCount > 0 ? `Connected ${connectionCount} wires` : 'No connections made',
      connectionCount 
    }
  }
  
  /**
   * Check if a mixed selection (gadgets + contacts) can connect to a target gadget
   * Counts total outputs from selected gadgets plus selected contacts
   */
  static canConnectMixedToGadget(
    selectedGadgets: ContactGroup[], 
    selectedContacts: Contact[], 
    targetGadget: ContactGroup
  ): boolean {
    // Count total outputs from selected gadgets
    let totalOutputs = 0
    for (const gadget of selectedGadgets) {
      const { outputs } = gadget.getBoundaryContacts()
      totalOutputs += outputs.length
    }
    
    // Add selected contacts (each contact counts as one output)
    totalOutputs += selectedContacts.length
    
    // Check if total matches target inputs
    const { inputs } = targetGadget.getBoundaryContacts()
    return totalOutputs > 0 && totalOutputs === inputs.length
  }
  
  /**
   * Connect mixed selection (gadget outputs + contacts) to a target gadget's inputs
   */
  executeMixedToGadget(
    parentGroup: ContactGroup,
    sourceGadgetIds: GroupId[],
    sourceContactIds: ContactId[],
    targetGadgetId: GroupId
  ): ValenceConnectionResult {
    const targetGadget = parentGroup.subgroups.get(targetGadgetId)
    if (!targetGadget) {
      return { success: false, message: 'Target gadget not found' }
    }
    
    // Collect all source outputs
    const sources: { id: ContactId, position: { x: number, y: number } }[] = []
    
    // Add outputs from source gadgets
    for (const gadgetId of sourceGadgetIds) {
      const gadget = parentGroup.subgroups.get(gadgetId)
      if (!gadget) continue
      
      const { outputs } = gadget.getBoundaryContacts()
      for (const output of outputs) {
        sources.push({ id: output.id, position: output.position })
      }
    }
    
    // Add source contacts
    for (const contactId of sourceContactIds) {
      const contact = parentGroup.contacts.get(contactId)
      if (!contact) continue
      sources.push({ id: contact.id, position: contact.position })
    }
    
    // Get target inputs
    const { inputs } = targetGadget.getBoundaryContacts()
    
    if (sources.length !== inputs.length) {
      return {
        success: false,
        message: `Source count (${sources.length}) doesn't match input count (${inputs.length})`
      }
    }
    
    // Sort both by Y position
    sources.sort((a, b) => a.position.y - b.position.y)
    const sortedInputs = [...inputs].sort((a, b) => a.position.y - b.position.y)
    
    // Connect them
    let connectionCount = 0
    for (let i = 0; i < sources.length; i++) {
      try {
        parentGroup.connect(sources[i].id, sortedInputs[i].id)
        connectionCount++
      } catch (error) {
        console.warn(`Failed to connect ${sources[i].id} to ${sortedInputs[i].id}:`, error)
      }
    }
    
    return {
      success: connectionCount > 0,
      message: connectionCount > 0 
        ? `Connected ${connectionCount} sources to inputs` 
        : 'No connections made',
      connectionCount
    }
  }
  
  /**
   * Find all gadgets that are valence-compatible with the given gadget
   */
  static findCompatibleGadgets(parentGroup: ContactGroup, gadgetId: GroupId): ContactGroup[] {
    const gadget = parentGroup.subgroups.get(gadgetId)
    if (!gadget) return []
    
    const compatible: ContactGroup[] = []
    for (const [otherId, otherGadget] of parentGroup.subgroups) {
      if (otherId !== gadgetId && this.areValenceCompatible(gadget, otherGadget)) {
        compatible.push(otherGadget)
      }
    }
    
    return compatible
  }
  
  /**
   * Check if contacts can connect to a gadget's inputs
   */
  static canConnectContactsToGadget(contacts: Contact[], gadget: ContactGroup): boolean {
    const { inputs } = gadget.getBoundaryContacts()
    return contacts.length > 0 && contacts.length === inputs.length
  }
  
  /**
   * Check if a gadget's outputs can connect to contacts
   */
  static canConnectGadgetToContacts(gadget: ContactGroup, contacts: Contact[]): boolean {
    const { outputs } = gadget.getBoundaryContacts()
    return contacts.length > 0 && outputs.length === contacts.length
  }
  
  /**
   * Connect selected contacts to a gadget's inputs
   */
  executeContactsToGadget(
    parentGroup: ContactGroup, 
    contactIds: ContactId[], 
    gadgetId: GroupId
  ): ValenceConnectionResult {
    const gadget = parentGroup.subgroups.get(gadgetId)
    if (!gadget) {
      return { success: false, message: 'Gadget not found' }
    }
    
    // Get contacts
    const contacts = contactIds
      .map(id => parentGroup.contacts.get(id))
      .filter((c): c is Contact => c !== undefined)
    
    if (contacts.length !== contactIds.length) {
      return { success: false, message: 'Some contacts not found' }
    }
    
    const { inputs } = gadget.getBoundaryContacts()
    
    if (contacts.length !== inputs.length) {
      return { 
        success: false, 
        message: `Contact count (${contacts.length}) doesn't match input count (${inputs.length})` 
      }
    }
    
    // Sort contacts and inputs by Y position
    const sortedContacts = [...contacts].sort((a, b) => a.position.y - b.position.y)
    const sortedInputs = [...inputs].sort((a, b) => a.position.y - b.position.y)
    
    // Connect them
    let connectionCount = 0
    for (let i = 0; i < sortedContacts.length; i++) {
      try {
        parentGroup.connect(sortedContacts[i].id, sortedInputs[i].id)
        connectionCount++
      } catch (error) {
        console.warn(`Failed to connect contact to input:`, error)
      }
    }
    
    return {
      success: connectionCount > 0,
      message: connectionCount > 0 ? `Connected ${connectionCount} contacts to inputs` : 'No connections made',
      connectionCount
    }
  }
  
  /**
   * Connect a gadget's outputs to selected contacts
   */
  executeGadgetToContacts(
    parentGroup: ContactGroup,
    gadgetId: GroupId,
    contactIds: ContactId[]
  ): ValenceConnectionResult {
    const gadget = parentGroup.subgroups.get(gadgetId)
    if (!gadget) {
      return { success: false, message: 'Gadget not found' }
    }
    
    // Get contacts
    const contacts = contactIds
      .map(id => parentGroup.contacts.get(id))
      .filter((c): c is Contact => c !== undefined)
    
    if (contacts.length !== contactIds.length) {
      return { success: false, message: 'Some contacts not found' }
    }
    
    const { outputs } = gadget.getBoundaryContacts()
    
    if (outputs.length !== contacts.length) {
      return { 
        success: false, 
        message: `Output count (${outputs.length}) doesn't match contact count (${contacts.length})` 
      }
    }
    
    // Sort outputs and contacts by Y position
    const sortedOutputs = [...outputs].sort((a, b) => a.position.y - b.position.y)
    const sortedContacts = [...contacts].sort((a, b) => a.position.y - b.position.y)
    
    // Connect them
    let connectionCount = 0
    for (let i = 0; i < sortedOutputs.length; i++) {
      try {
        parentGroup.connect(sortedOutputs[i].id, sortedContacts[i].id)
        connectionCount++
      } catch (error) {
        console.warn(`Failed to connect output to contact:`, error)
      }
    }
    
    return {
      success: connectionCount > 0,
      message: connectionCount > 0 ? `Connected ${connectionCount} outputs to contacts` : 'No connections made',
      connectionCount
    }
  }
}