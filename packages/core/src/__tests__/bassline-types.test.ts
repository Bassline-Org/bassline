import { describe, it, expect } from 'vitest'
import { brand } from '../types'
import {
  createEmptyBassline,
  hasCapability,
  applyAction,
  applyActionSet,
  type Bassline,
  type ReifiedContact,
  type ReifiedWire,
  type ReifiedGroup,
  type ReifiedAction,
  type ActionSet,
  type Capability
} from '../bassline-types'

describe('Bassline Types', () => {
  describe('Bassline creation', () => {
    it('should create an empty bassline', () => {
      const bassline = createEmptyBassline()
      
      expect(bassline.contacts).toBeInstanceOf(Map)
      expect(bassline.contacts.size).toBe(0)
      expect(bassline.wires).toBeInstanceOf(Map)
      expect(bassline.wires.size).toBe(0)
      expect(bassline.groups).toBeInstanceOf(Map)
      expect(bassline.groups.size).toBe(0)
      expect(bassline.gadgets).toBeInstanceOf(Map)
      expect(bassline.gadgets.size).toBe(0)
      expect(bassline.capabilities).toBeInstanceOf(Set)
      expect(bassline.version).toBe('1.0.0')
    })

    it('should create bassline with initial capabilities', () => {
      const capabilities = new Set<Capability>([
        'bassline.observe',
        'bassline.modify'
      ])
      const bassline = createEmptyBassline(capabilities)
      
      expect(bassline.capabilities).toEqual(capabilities)
      expect(hasCapability(bassline, 'bassline.observe')).toBe(true)
      expect(hasCapability(bassline, 'bassline.modify')).toBe(true)
      expect(hasCapability(bassline, 'bassline.meta')).toBe(false)
    })
  })

  describe('ReifiedContact', () => {
    it('should represent a contact as pure data', () => {
      const contact: ReifiedContact = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 42,
        blendMode: 'accept-last',
        name: 'TestContact',
        metadata: { created: Date.now() }
      }
      
      expect(contact.id).toBe('c1')
      expect(contact.groupId).toBe('g1')
      expect(contact.content).toBe(42)
      expect(contact.blendMode).toBe('accept-last')
    })

    it('should represent boundary contacts', () => {
      const boundary: ReifiedContact = {
        id: brand.contactId('b1'),
        groupId: brand.groupId('gadget1'),
        content: undefined,
        blendMode: 'accept-last',
        isBoundary: true,
        boundaryDirection: 'input',
        name: 'input_a'
      }
      
      expect(boundary.isBoundary).toBe(true)
      expect(boundary.boundaryDirection).toBe('input')
      expect(boundary.groupId).toBe('gadget1')
    })
  })

  describe('ReifiedWire', () => {
    it('should represent wires connecting contacts', () => {
      const wire: ReifiedWire = {
        id: brand.wireId('w1'),
        groupId: brand.groupId('g1'),
        fromId: brand.contactId('c1'),
        toId: brand.contactId('c2'),
        type: 'bidirectional'
      }
      
      expect(wire.fromId).toBe('c1')
      expect(wire.toId).toBe('c2')
      expect(wire.type).toBe('bidirectional')
    })
  })

  describe('Actions as Data', () => {
    it('should apply addContact action', () => {
      const bassline = createEmptyBassline()
      const contact: ReifiedContact = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'test',
        blendMode: 'accept-last'
      }
      
      const action: ReifiedAction = ['addContact', contact]
      const newBassline = applyAction(bassline, action)
      
      expect(newBassline.contacts.size).toBe(1)
      expect(newBassline.contacts.get(contact.id)).toEqual(contact)
      // Original should be unchanged (pure function)
      expect(bassline.contacts.size).toBe(0)
    })

    it('should apply removeContact action', () => {
      const contact: ReifiedContact = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'test',
        blendMode: 'accept-last'
      }
      
      const bassline: Bassline = {
        ...createEmptyBassline(),
        contacts: new Map([[contact.id, contact]])
      }
      
      const action: ReifiedAction = ['removeContact', contact.id]
      const newBassline = applyAction(bassline, action)
      
      expect(newBassline.contacts.size).toBe(0)
      expect(newBassline.contacts.has(contact.id)).toBe(false)
      // Original unchanged
      expect(bassline.contacts.size).toBe(1)
    })

    it('should apply updateContact action', () => {
      const contact: ReifiedContact = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'original',
        blendMode: 'accept-last'
      }
      
      const bassline: Bassline = {
        ...createEmptyBassline(),
        contacts: new Map([[contact.id, contact]])
      }
      
      const action: ReifiedAction = ['updateContact', contact.id, 'updated']
      const newBassline = applyAction(bassline, action)
      
      expect(newBassline.contacts.get(contact.id)?.content).toBe('updated')
      // Original unchanged
      expect(bassline.contacts.get(contact.id)?.content).toBe('original')
    })

    it('should apply wire actions', () => {
      const bassline = createEmptyBassline()
      const wire: ReifiedWire = {
        id: brand.wireId('w1'),
        groupId: brand.groupId('g1'),
        fromId: brand.contactId('c1'),
        toId: brand.contactId('c2'),
        type: 'bidirectional'
      }
      
      // Add wire
      const addAction: ReifiedAction = ['addWire', wire]
      const withWire = applyAction(bassline, addAction)
      expect(withWire.wires.size).toBe(1)
      expect(withWire.wires.get(wire.id)).toEqual(wire)
      
      // Remove wire
      const removeAction: ReifiedAction = ['removeWire', wire.id]
      const withoutWire = applyAction(withWire, removeAction)
      expect(withoutWire.wires.size).toBe(0)
    })

    it('should apply capability actions', () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      
      // Add capability
      const addCap: ReifiedAction = ['setCapability', 'bassline.modify', true]
      const withModify = applyAction(bassline, addCap)
      expect(hasCapability(withModify, 'bassline.modify')).toBe(true)
      expect(hasCapability(withModify, 'bassline.observe')).toBe(true)
      
      // Remove capability
      const removeCap: ReifiedAction = ['setCapability', 'bassline.observe', false]
      const withoutObserve = applyAction(withModify, removeCap)
      expect(hasCapability(withoutObserve, 'bassline.observe')).toBe(false)
      expect(hasCapability(withoutObserve, 'bassline.modify')).toBe(true)
    })

    it('should apply complete bassline replacement', () => {
      const original = createEmptyBassline()
      const replacement = createEmptyBassline(new Set(['bassline.meta']))
      replacement.contacts.set(
        brand.contactId('new'),
        {
          id: brand.contactId('new'),
          groupId: brand.groupId('g1'),
          content: 'replaced',
          blendMode: 'accept-last'
        }
      )
      
      const action: ReifiedAction = ['applyBassline', replacement]
      const result = applyAction(original, action)
      
      expect(result).toEqual(replacement)
      expect(result.contacts.size).toBe(1)
      expect(hasCapability(result, 'bassline.meta')).toBe(true)
    })
  })

  describe('ActionSet', () => {
    it('should apply multiple actions in sequence', () => {
      const bassline = createEmptyBassline()
      
      const contact1: ReifiedContact = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'first',
        blendMode: 'accept-last'
      }
      
      const contact2: ReifiedContact = {
        id: brand.contactId('c2'),
        groupId: brand.groupId('g1'),
        content: 'second',
        blendMode: 'merge'
      }
      
      const wire: ReifiedWire = {
        id: brand.wireId('w1'),
        groupId: brand.groupId('g1'),
        fromId: contact1.id,
        toId: contact2.id,
        type: 'bidirectional'
      }
      
      const actionSet: ActionSet = {
        actions: [
          ['addContact', contact1],
          ['addContact', contact2],
          ['addWire', wire],
          ['updateContact', contact1.id, 'updated']
        ],
        timestamp: Date.now(),
        source: 'test'
      }
      
      const result = applyActionSet(bassline, actionSet)
      
      expect(result.contacts.size).toBe(2)
      expect(result.wires.size).toBe(1)
      expect(result.contacts.get(contact1.id)?.content).toBe('updated')
      expect(result.contacts.get(contact2.id)?.content).toBe('second')
      expect(result.wires.get(wire.id)).toEqual(wire)
    })

    it('should handle conflicting actions (last-write-wins)', () => {
      const bassline = createEmptyBassline()
      const contactId = brand.contactId('c1')
      
      const contact: ReifiedContact = {
        id: contactId,
        groupId: brand.groupId('g1'),
        content: 'initial',
        blendMode: 'accept-last'
      }
      
      const actionSet: ActionSet = {
        actions: [
          ['addContact', contact],
          ['updateContact', contactId, 'first update'],
          ['updateContact', contactId, 'second update'],
          ['updateContact', contactId, 'final update']
        ],
        timestamp: Date.now(),
        source: 'test'
      }
      
      const result = applyActionSet(bassline, actionSet)
      
      expect(result.contacts.get(contactId)?.content).toBe('final update')
    })
  })

  describe('Bassline as buildable data', () => {
    it('should be constructible as plain objects and maps', () => {
      // This demonstrates that basslines can be built from within the network
      // using regular data construction operations
      
      const contacts = new Map<ContactId, ReifiedContact>()
      contacts.set(brand.contactId('c1'), {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 42,
        blendMode: 'accept-last'
      })
      
      const bassline: Bassline = {
        contacts,
        wires: new Map(),
        groups: new Map(),
        gadgets: new Map(),
        capabilities: new Set(['bassline.observe']),
        version: '1.0.0',
        metadata: {
          createdBy: 'test',
          createdAt: Date.now()
        }
      }
      
      expect(bassline.contacts.size).toBe(1)
      expect(bassline.metadata?.createdBy).toBe('test')
      
      // Can be serialized and deserialized (important for network transfer)
      const json = JSON.stringify({
        contacts: Array.from(bassline.contacts.entries()),
        wires: Array.from(bassline.wires.entries()),
        groups: Array.from(bassline.groups.entries()),
        gadgets: Array.from(bassline.gadgets.entries()),
        capabilities: Array.from(bassline.capabilities),
        version: bassline.version,
        metadata: bassline.metadata
      })
      
      const parsed = JSON.parse(json)
      const reconstructed: Bassline = {
        contacts: new Map(parsed.contacts),
        wires: new Map(parsed.wires),
        groups: new Map(parsed.groups),
        gadgets: new Map(parsed.gadgets),
        capabilities: new Set(parsed.capabilities),
        version: parsed.version,
        metadata: parsed.metadata
      }
      
      expect(reconstructed.contacts.size).toBe(1)
      expect(reconstructed.capabilities.has('bassline.observe')).toBe(true)
    })
  })
})