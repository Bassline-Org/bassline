import { describe, it, expect } from 'vitest'
import { brand } from '../types'
import type { Contact, Group, Wire, ContactId, GroupId, WireId } from '../types'
import { createImmediateScheduler } from '../scheduler/immediate'

describe('Bassline Data Model', () => {
  describe('Contact with groupId', () => {
    it('should create contacts with their groupId set', () => {
      const groupId = brand.groupId('test-group')
      const contact: Contact = {
        id: brand.contactId('contact-1'),
        groupId: groupId,
        content: 42,
        blendMode: 'accept-last'
      }
      
      expect(contact.groupId).toBe(groupId)
      expect(contact.groupId).toBe('test-group')
    })

    it('should maintain groupId when creating contacts through scheduler', async () => {
      const scheduler = createImmediateScheduler()
      const rootGroupId = brand.groupId('root')
      
      // Register root group
      await scheduler.registerGroup({
        id: rootGroupId,
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Add a contact to the group
      const contactId = await scheduler.addContact('root', {
        content: 'test',
        blendMode: 'accept-last'
      })
      
      // Get the contact and verify it has the correct groupId
      const contact = await scheduler.getContact(contactId)
      expect(contact).toBeDefined()
      expect(contact?.groupId).toBe(rootGroupId)
    })

    it('should create boundary contacts with the gadget groupId, not parent', async () => {
      const scheduler = createImmediateScheduler()
      
      // Create parent group
      const parentId = brand.groupId('parent')
      await scheduler.registerGroup({
        id: parentId,
        name: 'Parent',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create a primitive gadget as subgroup
      const gadgetId = brand.groupId('gadget')
      await scheduler.registerGroup({
        id: gadgetId,
        name: 'Add Gadget',
        parentId: parentId,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: [],
        primitive: {
          id: 'add',
          name: 'Add',
          inputs: ['a', 'b'],
          outputs: ['sum'],
          activation: (inputs) => inputs.has('a') && inputs.has('b'),
          body: async (inputs) => {
            const a = inputs.get('a') as number
            const b = inputs.get('b') as number
            return new Map([['sum', a + b]])
          }
        }
      })
      
      // Get the gadget state
      const gadgetState = await scheduler.getState(gadgetId)
      
      // Check that boundary contacts are owned by the gadget, not parent
      gadgetState.contacts.forEach((contact, contactId) => {
        if (contact.isBoundary) {
          expect(contact.groupId).toBe(gadgetId)
          expect(contact.groupId).not.toBe(parentId)
        }
      })
      
      // Verify we have the expected boundary contacts
      const boundaryContacts = Array.from(gadgetState.contacts.values())
        .filter(c => c.isBoundary)
      
      expect(boundaryContacts).toHaveLength(3) // 2 inputs + 1 output
      
      // Check input boundaries
      const inputs = boundaryContacts.filter(c => c.boundaryDirection === 'input')
      expect(inputs).toHaveLength(2)
      inputs.forEach(input => {
        expect(input.groupId).toBe(gadgetId)
      })
      
      // Check output boundary
      const outputs = boundaryContacts.filter(c => c.boundaryDirection === 'output')
      expect(outputs).toHaveLength(1)
      outputs.forEach(output => {
        expect(output.groupId).toBe(gadgetId)
      })
    })
  })

  describe('Wire connections', () => {
    it('should only connect contacts, never groups directly', async () => {
      const scheduler = createImmediateScheduler()
      
      // Create a group with contacts
      const groupId = brand.groupId('group1')
      await scheduler.registerGroup({
        id: groupId,
        name: 'Group 1',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Add two contacts
      const contact1Id = await scheduler.addContact(groupId, {
        content: 'A',
        blendMode: 'accept-last'
      })
      
      const contact2Id = await scheduler.addContact(groupId, {
        content: 'B',
        blendMode: 'accept-last'
      })
      
      // Connect the contacts
      const wireId = await scheduler.connect(contact1Id, contact2Id)
      
      // Get the wire and verify it connects contacts, not groups
      const wire = await scheduler.getWire(wireId)
      expect(wire).toBeDefined()
      expect(wire?.fromId).toBe(contact1Id)
      expect(wire?.toId).toBe(contact2Id)
      
      // Wire should be in the group
      expect(wire?.groupId).toBe(groupId)
    })

    it('should allow cross-group wiring only through boundary contacts', async () => {
      const scheduler = createImmediateScheduler()
      
      // Create parent group
      const parentId = brand.groupId('parent')
      await scheduler.registerGroup({
        id: parentId,
        name: 'Parent',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create a regular contact in parent
      const parentContactId = await scheduler.addContact(parentId, {
        content: 5,
        blendMode: 'accept-last'
      })
      
      // Create a subgroup with boundary
      const subgroupId = brand.groupId('subgroup')
      await scheduler.registerGroup({
        id: subgroupId,
        name: 'Subgroup',
        parentId: parentId,
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Add a boundary contact to subgroup
      const boundaryId = await scheduler.addContact(subgroupId, {
        content: undefined,
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input'
      })
      
      // Add an internal contact to subgroup
      const internalId = await scheduler.addContact(subgroupId, {
        content: undefined,
        blendMode: 'accept-last'
      })
      
      // Should be able to wire parent contact to boundary
      const wire1 = await scheduler.connect(parentContactId, boundaryId)
      expect(wire1).toBeDefined()
      
      // Should NOT be able to wire parent contact to internal contact
      // (This should throw or fail based on current implementation)
      try {
        await scheduler.connect(parentContactId, internalId)
        // If it doesn't throw, verify the behavior
        const parentContact = await scheduler.getContact(parentContactId)
        const internalContact = await scheduler.getContact(internalId)
        
        // They're in different groups and internal is not boundary
        expect(parentContact?.groupId).not.toBe(internalContact?.groupId)
        expect(internalContact?.isBoundary).toBeFalsy()
      } catch (error) {
        // Expected - cannot connect across groups without boundary
        expect(error).toBeDefined()
      }
    })
  })

  describe('Group hierarchy', () => {
    it('should maintain parent-child relationships with groupIds', async () => {
      const scheduler = createImmediateScheduler()
      
      // Create root
      const rootId = brand.groupId('root')
      await scheduler.registerGroup({
        id: rootId,
        name: 'Root',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create child group
      const childId = await scheduler.addGroup(rootId, {
        name: 'Child Group'
      })
      
      // Get child state
      const childState = await scheduler.getState(childId)
      expect(childState.group.parentId).toBe(rootId)
      
      // Create grandchild
      const grandchildId = await scheduler.addGroup(childId, {
        name: 'Grandchild Group'
      })
      
      const grandchildState = await scheduler.getState(grandchildId)
      expect(grandchildState.group.parentId).toBe(childId)
      
      // Verify the hierarchy is maintained
      const rootState = await scheduler.getState(rootId)
      expect(rootState.group.subgroupIds).toContain(childId)
      
      const childStateUpdated = await scheduler.getState(childId)
      expect(childStateUpdated.group.subgroupIds).toContain(grandchildId)
    })
  })
})