import { describe, it, expect, vi } from 'vitest'
import { brand } from '../../types'
import type { Bassline, ActionSet, ReifiedContact } from '../../bassline-types'
import { createEmptyBassline } from '../../bassline-types'
import { 
  createBasslineGadget, 
  createReadOnlyBasslineGadget,
  createAddContactGadget,
  shouldHaveBasslineGadget
} from '../bassline-gadget'

describe('Bassline Gadget', () => {
  describe('createBasslineGadget', () => {
    it('should create a bassline gadget with correct structure', () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      const getBassline = () => bassline
      
      const gadget = createBasslineGadget(getBassline)
      
      expect(gadget.id).toBe('bassline')
      expect(gadget.name).toBe('Bassline')
      expect(gadget.inputs).toContain('refresh')
      expect(gadget.outputs).toEqual([
        'bassline',
        'appliedActions',
        'groupId',
        'parentId',
        'capabilities'
      ])
      expect(gadget.isPure).toBe(false)
    })

    it('should include merge input when bassline has modify capability', () => {
      const bassline = createEmptyBassline(new Set(['bassline.modify']))
      const getBassline = () => bassline
      
      const gadget = createBasslineGadget(getBassline)
      
      expect(gadget.inputs).toContain('refresh')
      expect(gadget.inputs).toContain('merge')
    })

    it('should not include merge input for read-only bassline', () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      const getBassline = () => bassline
      
      const gadget = createBasslineGadget(getBassline)
      
      expect(gadget.inputs).toContain('refresh')
      expect(gadget.inputs).not.toContain('merge')
    })

    it('should output current bassline when activated', async () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      bassline.contacts.set(brand.contactId('c1'), {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'test',
        blendMode: 'accept-last'
      })
      
      const getBassline = () => bassline
      const gadget = createBasslineGadget(getBassline, undefined, 'g1', 'parent')
      
      // Test activation
      expect(gadget.activation(new Map())).toBe(true)  // Activates with no inputs
      expect(gadget.activation(new Map([['refresh', true]]))).toBe(true)
      
      // Test body execution
      const outputs = await gadget.body(new Map())
      
      expect(outputs.get('bassline')).toBe(bassline)
      expect(outputs.get('groupId')).toBe('g1')
      expect(outputs.get('parentId')).toBe('parent')
      expect(outputs.get('capabilities')).toEqual(['bassline.observe'])
    })

    it('should apply actions when merge input is provided', async () => {
      const bassline = createEmptyBassline(new Set(['bassline.modify']))
      const getBassline = () => bassline
      const applyActions = vi.fn(async () => {
        // Simulate applying actions by modifying bassline
        bassline.contacts.set(brand.contactId('new'), {
          id: brand.contactId('new'),
          groupId: brand.groupId('g1'),
          content: 'added',
          blendMode: 'accept-last'
        })
      })
      
      const gadget = createBasslineGadget(getBassline, applyActions)
      
      const actionSet: ActionSet = {
        actions: [
          ['addContact', {
            id: brand.contactId('new'),
            groupId: brand.groupId('g1'),
            content: 'added',
            blendMode: 'accept-last'
          } as ReifiedContact]
        ],
        timestamp: Date.now(),
        source: 'test'
      }
      
      // Test activation with merge input
      expect(gadget.activation(new Map([['merge', actionSet]]))).toBe(true)
      
      // Test body execution with merge
      const outputs = await gadget.body(new Map([['merge', actionSet]]))
      
      expect(applyActions).toHaveBeenCalledWith(actionSet)
      expect(outputs.get('appliedActions')).toBe(actionSet)
      expect(outputs.get('bassline')).toBe(bassline)
      expect(bassline.contacts.size).toBe(1)
    })
  })

  describe('createReadOnlyBasslineGadget', () => {
    it('should create a read-only gadget', () => {
      const bassline = createEmptyBassline()
      const getBassline = () => bassline
      
      const gadget = createReadOnlyBasslineGadget(getBassline, 'g1')
      
      expect(gadget.id).toBe('bassline-readonly')
      expect(gadget.inputs).toEqual(['refresh'])
      expect(gadget.outputs).not.toContain('appliedActions')
      expect(gadget.isPure).toBe(true)
    })

    it('should always activate', () => {
      const bassline = createEmptyBassline()
      const gadget = createReadOnlyBasslineGadget(() => bassline)
      
      expect(gadget.activation(new Map())).toBe(true)
      expect(gadget.activation(new Map([['anything', 'value']]))).toBe(true)
    })

    it('should output bassline without modification capability', async () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      const gadget = createReadOnlyBasslineGadget(() => bassline, 'g1', 'parent')
      
      const outputs = await gadget.body(new Map())
      
      expect(outputs.get('bassline')).toBe(bassline)
      expect(outputs.get('groupId')).toBe('g1')
      expect(outputs.get('parentId')).toBe('parent')
      expect(outputs.get('capabilities')).toEqual(['bassline.observe'])
    })
  })

  describe('createAddContactGadget', () => {
    it('should create action for adding contact', async () => {
      const gadget = createAddContactGadget()
      
      expect(gadget.id).toBe('add-contact')
      expect(gadget.inputs).toEqual(['contactData'])
      expect(gadget.outputs).toEqual(['action'])
      expect(gadget.isPure).toBe(true)
    })

    it('should generate add contact action', async () => {
      const gadget = createAddContactGadget()
      
      const contactData = {
        id: brand.contactId('c1'),
        groupId: brand.groupId('g1'),
        content: 'test',
        blendMode: 'accept-last' as const
      }
      
      const outputs = await gadget.body(new Map([['contactData', contactData]]))
      const actionSet = outputs.get('action') as ActionSet
      
      expect(actionSet).toBeDefined()
      expect(actionSet.actions).toHaveLength(1)
      expect(actionSet.actions[0]).toEqual(['addContact', contactData])
      expect(actionSet.source).toBe('add-contact-gadget')
    })

    it('should return empty map when no contact data', async () => {
      const gadget = createAddContactGadget()
      
      const outputs = await gadget.body(new Map())
      
      expect(outputs.size).toBe(0)
    })
  })

  describe('shouldHaveBasslineGadget', () => {
    it('should return true for bassline with observe capability', () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe']))
      expect(shouldHaveBasslineGadget(bassline)).toBe(true)
    })

    it('should return true for bassline with modify capability', () => {
      const bassline = createEmptyBassline(new Set(['bassline.modify']))
      expect(shouldHaveBasslineGadget(bassline)).toBe(true)
    })

    it('should return true for bassline with both capabilities', () => {
      const bassline = createEmptyBassline(new Set(['bassline.observe', 'bassline.modify']))
      expect(shouldHaveBasslineGadget(bassline)).toBe(true)
    })

    it('should return false for bassline without relevant capabilities', () => {
      const bassline = createEmptyBassline(new Set(['bassline.spawn']))
      expect(shouldHaveBasslineGadget(bassline)).toBe(false)
    })

    it('should return false for bassline with no capabilities', () => {
      const bassline = createEmptyBassline()
      expect(shouldHaveBasslineGadget(bassline)).toBe(false)
    })
  })
})