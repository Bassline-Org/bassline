import { describe, it, expect, beforeEach } from 'vitest'
import { Bassline } from '@bassline/core'
import installWidgets from '../src/upgrade.js'

describe('UI Instance Routes', () => {
  let bl

  beforeEach(async () => {
    bl = new Bassline()
    installWidgets(bl)
  })

  describe('GET /ui', () => {
    it('lists all instances', async () => {
      // Create some instances
      await bl.put('bl:///ui/app', {}, { definition: ['box'] })
      await bl.put('bl:///ui/sidebar', {}, { definition: ['stack'] })

      const result = await bl.get('bl:///ui')

      expect(result.headers.type).toBe('bl:///types/directory')
      expect(result.body.entries).toHaveLength(2)
      expect(result.body.entries.map((e) => e.name).sort()).toEqual(['app', 'sidebar'])
    })
  })

  describe('PUT /ui/:path', () => {
    it('creates an instance', async () => {
      const result = await bl.put(
        'bl:///ui/dashboard',
        {},
        {
          definition: ['stack', { gap: 16 }],
          widget: 'bl:///widgets/dashboard',
          widgetConfig: { title: 'My Dashboard' },
        }
      )

      expect(result.headers.type).toBe('bl:///types/widget-instance')
      expect(result.body.name).toBe('dashboard')
      expect(result.body.definition).toEqual(['stack', { gap: 16 }])
      expect(result.body.widget).toBe('bl:///widgets/dashboard')
    })

    it('creates nested instances', async () => {
      await bl.put('bl:///ui/app/sidebar', {}, { definition: ['box'] })
      await bl.put('bl:///ui/app/main', {}, { definition: ['box'] })

      const sidebar = await bl.get('bl:///ui/app/sidebar')
      expect(sidebar.body.name).toBe('app/sidebar')

      const main = await bl.get('bl:///ui/app/main')
      expect(main.body.name).toBe('app/main')
    })
  })

  describe('GET /ui/:path', () => {
    it('returns instance with sub-resource entries', async () => {
      await bl.put('bl:///ui/test', {}, { definition: ['button'] })

      const result = await bl.get('bl:///ui/test')

      expect(result.body.entries).toContainEqual({ name: 'state', uri: 'bl:///ui/test/state' })
      expect(result.body.entries).toContainEqual({ name: 'props', uri: 'bl:///ui/test/props' })
      expect(result.body.entries).toContainEqual({ name: 'ctl', uri: 'bl:///ui/test/ctl' })
    })

    it('returns null for non-existent instance', async () => {
      const result = await bl.get('bl:///ui/missing')
      expect(result).toBeNull()
    })
  })

  describe('Instance State', () => {
    beforeEach(async () => {
      await bl.put(
        'bl:///ui/counter',
        {},
        {
          definition: ['text', { content: '0' }],
          state: { count: 0 },
        }
      )
    })

    it('gets instance state', async () => {
      const result = await bl.get('bl:///ui/counter/state')

      expect(result.headers.type).toBe('bl:///types/ui-state')
      expect(result.body.count).toBe(0)
    })

    it('updates instance state', async () => {
      await bl.put('bl:///ui/counter/state', {}, { count: 5 })

      const result = await bl.get('bl:///ui/counter/state')
      expect(result.body.count).toBe(5)
    })

    it('merges state on update', async () => {
      await bl.put('bl:///ui/counter/state', {}, { count: 5 })
      await bl.put('bl:///ui/counter/state', {}, { label: 'Counter' })

      const result = await bl.get('bl:///ui/counter/state')
      expect(result.body.count).toBe(5)
      expect(result.body.label).toBe('Counter')
    })

    it('auto-creates instance when setting state', async () => {
      await bl.put('bl:///ui/new-instance/state', {}, { value: 42 })

      const instance = await bl.get('bl:///ui/new-instance')
      expect(instance).not.toBeNull()
      expect(instance.body.state.value).toBe(42)
    })
  })

  describe('Instance Props', () => {
    beforeEach(async () => {
      await bl.put(
        'bl:///ui/button',
        {},
        {
          definition: ['button', { label: 'Click' }],
          props: { disabled: false },
        }
      )
    })

    it('gets instance props', async () => {
      const result = await bl.get('bl:///ui/button/props')

      expect(result.headers.type).toBe('bl:///types/ui-props')
      expect(result.body.disabled).toBe(false)
    })
  })

  describe('Instance Control', () => {
    beforeEach(async () => {
      await bl.put(
        'bl:///ui/form',
        {},
        {
          definition: ['stack'],
          state: { name: 'Alice', email: 'alice@example.com' },
        }
      )
    })

    it('handles reset command', async () => {
      const result = await bl.put('bl:///ui/form/ctl', {}, { command: 'reset' })

      expect(result.body.success).toBe(true)
      expect(result.body.command).toBe('reset')

      const state = await bl.get('bl:///ui/form/state')
      expect(state.body).toEqual({})
    })

    it('handles setState command', async () => {
      const result = await bl.put(
        'bl:///ui/form/ctl',
        {},
        {
          command: 'setState',
          name: 'Bob',
        }
      )

      expect(result.body.success).toBe(true)

      const state = await bl.get('bl:///ui/form/state')
      expect(state.body.name).toBe('Bob')
      expect(state.body.email).toBe('alice@example.com')
    })

    it('returns error for unknown command', async () => {
      const result = await bl.put('bl:///ui/form/ctl', {}, { command: 'unknown' })

      expect(result.body.success).toBe(false)
      expect(result.body.error).toContain('Unknown command')
    })
  })

  describe('Instance Deletion', () => {
    it('deletes an instance', async () => {
      await bl.put('bl:///ui/temp', {}, { definition: ['box'] })

      const result = await bl.put('bl:///ui/temp/delete', {}, {})

      expect(result.headers.type).toBe('bl:///types/resource-removed')

      const check = await bl.get('bl:///ui/temp')
      expect(check).toBeNull()
    })

    it('returns null when deleting non-existent instance', async () => {
      const result = await bl.put('bl:///ui/missing/delete', {}, {})
      expect(result).toBeNull()
    })
  })

  describe('Children', () => {
    it('lists child instances', async () => {
      await bl.put('bl:///ui/app', {}, { definition: ['box'] })
      await bl.put('bl:///ui/app/header', {}, { definition: ['box'] })
      await bl.put('bl:///ui/app/sidebar', {}, { definition: ['box'] })
      await bl.put('bl:///ui/app/main', {}, { definition: ['box'] })
      await bl.put('bl:///ui/other', {}, { definition: ['box'] })

      const result = await bl.get('bl:///ui/app/children')

      expect(result.headers.type).toBe('bl:///types/directory')
      expect(result.body.entries).toHaveLength(3)
      expect(result.body.entries.map((e) => e.name).sort()).toEqual(['header', 'main', 'sidebar'])
    })
  })

  describe('Root Instance', () => {
    it('creates the root instance for rendering', async () => {
      await bl.put(
        'bl:///ui/root',
        {},
        {
          content: 'bl:///ui/app',
        }
      )

      const result = await bl.get('bl:///ui/root')

      expect(result.body.name).toBe('root')
    })

    it('supports inline definition in root', async () => {
      await bl.put(
        'bl:///ui/root',
        {},
        {
          definition: [
            'stack',
            { gap: 16 },
            ['heading', { content: 'Hello' }],
            ['button', { label: 'Click' }],
          ],
        }
      )

      const result = await bl.get('bl:///ui/root')

      expect(result.body.definition).toEqual([
        'stack',
        { gap: 16 },
        ['heading', { content: 'Hello' }],
        ['button', { label: 'Click' }],
      ])
    })
  })
})
