/**
 * Core functionality tests for Pico-Bassline
 */

import { Group, WireMode } from '../src/core'
import type { Value } from '../src/types'

describe('Contact', () => {
  let group: Group

  beforeEach(() => {
    group = new Group('test-group')
  })

  describe('value propagation', () => {
    it('should propagate value changes to targets', () => {
      const source = group.createContact('source', 10)
      const target = group.createContact('target')

      source.wireTo(target)
      source.setValue(20)

      expect(target.value).toBe(20)
      expect(target.old).toBe(undefined)
    })

    it('should maintain old value on updates', () => {
      const contact = group.createContact('test', 10)
      
      contact.setValue(20)
      expect(contact.value).toBe(20)
      expect(contact.old).toBe(10)

      contact.setValue(30)
      expect(contact.value).toBe(30)
      expect(contact.old).toBe(20)
    })

    it('should not propagate if value unchanged', () => {
      const source = group.createContact('source', 10)
      const target = group.createContact('target')
      
      source.wireTo(target)
      source.setValue(10) // Same value

      expect(target.value).toBeUndefined() // Never received update
    })
  })

  describe('access control', () => {
    it('should enforce boundary permissions', () => {
      const parentGroup = new Group('parent')
      const childGroup = parentGroup.createGroup('child')

      const boundary = childGroup.createContact('boundary', undefined, {
        boundary: true,
        internal: 'read',
        external: 'write'
      })

      const external = parentGroup.createContact('external')
      const internal = childGroup.createContact('internal')

      // External can write to boundary
      expect(() => external.wireTo(boundary)).not.toThrow()
      
      // Internal cannot write to boundary with FORWARD_ONLY (read-only internally)
      expect(() => internal.wireTo(boundary, WireMode.FORWARD_ONLY)).toThrow()
    })

    it('should handle meta-contact special rules', () => {
      const parentGroup = new Group('parent')
      const childGroup = parentGroup.createGroup('child')

      const parentContact = parentGroup.createContact('parent-contact')
      const childContact = childGroup.createContact('child-contact')

      // Parent can write to child's meta-properties
      const childProps = childGroup.properties
      if (childProps) {
        expect(childProps.canWrite(parentContact)).toBe(true)
        expect(childProps.canWrite(childContact)).toBe(false)
      }

      // Actions can be written internally
      const childActions = childGroup.actions
      if (childActions) {
        expect(childActions.canWrite(childContact)).toBe(true)
        expect(childActions.canWrite(parentContact)).toBe(true)
      }
    })

    it('should prevent reading dynamics internally', () => {
      const dynamics = group.dynamics
      const internal = group.createContact('internal')

      if (dynamics) {
        expect(dynamics.canRead(internal)).toBe(false)
      }
    })
  })

  describe('smart wiring', () => {
    it('should create bidirectional wires with AUTO mode', () => {
      const a = group.createContact('a')
      const b = group.createContact('b')

      expect(() => a.wireTo(b, WireMode.AUTO)).not.toThrow()

      // Test both directions work
      a.setValue(10)
      expect(b.value).toBe(10)

      b.setValue(20)
      expect(a.value).toBe(20)
    })

    it('should create single direction with FORWARD_ONLY', () => {
      const a = group.createContact('a')
      const b = group.createContact('b')

      a.wireTo(b, WireMode.FORWARD_ONLY)

      a.setValue(10)
      expect(b.value).toBe(10)

      b.setValue(20)
      expect(a.value).not.toBe(20) // Should not propagate backward
    })

    it('should respect permissions in wiring', () => {
      // Test boundary permissions - boundaries control access
      const boundary = group.createContact('boundary', undefined, {
        boundary: true,
        internal: 'read',  // Internal contacts can only read
        external: 'none'
      })

      const normal = group.createContact('normal')

      // Internal contact cannot write to read-only boundary
      expect(() => normal.wireTo(boundary, WireMode.FORWARD_ONLY)).toThrow()
      
      // But boundary CAN write to internal (boundary is readable)
      expect(() => boundary.wireTo(normal, WireMode.FORWARD_ONLY)).not.toThrow()
    })
  })

  describe('lazy accessors', () => {
    it('should provide current value', () => {
      const contact = group.createContact('test', 42)
      expect(contact.current).toBe(42)
    })

    it('should provide [new, old] pair', () => {
      const contact = group.createContact('test', 10)
      contact.setValue(20)
      
      const [newVal, oldVal] = contact.pair
      expect(newVal).toBe(20)
      expect(oldVal).toBe(10)
    })
  })
})

describe('Group', () => {
  describe('meta-contacts', () => {
    it('should create meta-contacts for non-primitive groups', () => {
      const group = new Group('test')

      expect(group.properties).toBeDefined()
      expect(group.structure).toBeDefined()
      expect(group.dynamics).toBeDefined()
      expect(group.actions).toBeDefined()
    })

    it('should not create structure/dynamics/actions for primitives', () => {
      const group = new Group('test', {
        primitive: true,
        name: 'test-primitive',
        compute: () => 0
      })

      expect(group.properties).toBeDefined()
      expect(group.structure).toBeUndefined()
      expect(group.dynamics).toBeUndefined()
      expect(group.actions).toBeUndefined()
    })

    it('should update structure when contacts added', () => {
      const group = new Group('test')
      
      group.createContact('a')
      group.createContact('b')
      
      const structure = group.structure?.value as any
      const contactIds = structure.contacts.map((c: any) => c.id)
      expect(contactIds).toContain('a')
      expect(contactIds).toContain('b')
    })

    it('should update structure when groups added', () => {
      const group = new Group('test')
      
      group.createGroup('child1')
      group.createGroup('child2')
      
      const structure = group.structure?.value as any
      expect(structure.groups).toContain('child1')
      expect(structure.groups).toContain('child2')
    })
  })

  describe('primitive execution', () => {
    it('should execute compute function', () => {
      const group = new Group('adder', {
        primitive: true,
        name: 'add',
        compute: (inputs: Record<string, Value>) => {
          const a = inputs.a as number ?? 0
          const b = inputs.b as number ?? 0
          return a + b
        }
      })

      group.createContact('a', 5)
      group.createContact('b', 10)
      group.createContact('output')

      group.execute()

      expect(group.contacts.get('output')?.value).toBe(15)
    })

    it('should pass history when needsHistory is true', () => {
      const group = new Group('merger', {
        primitive: true,
        name: 'max-merge',
        needsHistory: true,
        compute: (inputs: Record<string, Value>) => {
          const [newVal, oldVal] = inputs.input as [number, number]
          return Math.max(newVal, oldVal ?? 0)
        }
      })

      const input = group.createContact('input', 10)
      group.createContact('output')

      input.setValue(5)
      group.execute()

      // Should get [5, 10] and return 10 (max)
      expect(group.contacts.get('output')?.value).toBe(10)
    })
  })

  describe('hierarchy', () => {
    it('should support nested groups', () => {
      const root = new Group('root')
      const child = root.createGroup('child')
      const grandchild = child.createGroup('grandchild')

      expect(child.parent).toBe(root)
      expect(grandchild.parent).toBe(child)
    })

    it('should allow parent to access child boundaries', () => {
      const parent = new Group('parent')
      const child = parent.createGroup('child')

      const parentContact = parent.createContact('p')
      const childBoundary = child.createContact('boundary', undefined, {
        boundary: true,
        internal: 'write',
        external: 'read'
      })

      child.execute() // Trigger some internal operation
      childBoundary.setValue(42)

      // Parent cannot write to child boundary (but AUTO will create backward connection)
      // Child boundary can wire to parent (creates forward connection)
      expect(() => childBoundary.wireTo(parentContact)).not.toThrow()
      
      // But parent cannot write with FORWARD_ONLY
      expect(() => parentContact.wireTo(childBoundary, WireMode.FORWARD_ONLY)).toThrow()
    })
  })
})