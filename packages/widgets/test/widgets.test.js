import { describe, it, expect, beforeEach } from 'vitest'
import { Bassline } from '@bassline/core'
import { createWidgetRegistry } from '../src/registry.js'
import { createCompiler } from '../src/compiler.js'
import installWidgets from '../src/upgrade.js'

describe('Widget Registry', () => {
  let registry

  beforeEach(() => {
    registry = createWidgetRegistry()
  })

  describe('primitives', () => {
    it('registers and retrieves primitives', () => {
      registry.registerPrimitive('button', {
        type: 'bl:///types/widgets/atom/button',
        props: { label: { type: 'string' } },
        render: () => {},
      })

      const widget = registry.getSync('bl:///widgets/button')
      expect(widget).not.toBeNull()
      expect(widget.primitive).toBe(true)
      expect(widget.name).toBe('button')
      expect(widget.type).toBe('bl:///types/widgets/atom/button')
    })

    it('lists primitives', () => {
      registry.registerPrimitive('button', {
        type: 'bl:///types/widgets/atom/button',
        render: () => {},
      })
      registry.registerPrimitive('text', {
        type: 'bl:///types/widgets/atom/text',
        render: () => {},
      })

      const primitives = registry.listPrimitives()
      expect(primitives).toContain('bl:///widgets/button')
      expect(primitives).toContain('bl:///widgets/text')
    })

    it('checks isPrimitive', () => {
      registry.registerPrimitive('button', {
        type: 'bl:///types/widgets/atom/button',
        render: () => {},
      })
      expect(registry.isPrimitive('bl:///widgets/button')).toBe(true)
      expect(registry.isPrimitive('bl:///widgets/unknown')).toBe(false)
    })
  })

  describe('custom widgets', () => {
    it('registers and retrieves custom widgets', () => {
      registry.registerCustom('bl:///widgets/my-button', {
        name: 'my-button',
        type: 'bl:///types/widgets/custom',
        props: { color: { type: 'string' } },
        definition: ['button', { label: 'Click me' }],
        description: 'A custom button',
      })

      const widget = registry.getSync('bl:///widgets/my-button')
      expect(widget).not.toBeNull()
      expect(widget.primitive).toBe(false)
      expect(widget.name).toBe('my-button')
      expect(widget.definition).toEqual(['button', { label: 'Click me' }])
    })

    it('lists custom widgets', () => {
      registry.registerCustom('bl:///widgets/a', { name: 'a', definition: ['box'] })
      registry.registerCustom('bl:///widgets/b', { name: 'b', definition: ['box'] })

      const custom = registry.listCustom()
      expect(custom).toContain('bl:///widgets/a')
      expect(custom).toContain('bl:///widgets/b')
    })

    it('deletes custom widgets', () => {
      registry.registerCustom('bl:///widgets/temp', { name: 'temp', definition: ['box'] })
      expect(registry.has('bl:///widgets/temp')).toBe(true)

      registry.deleteCustom('bl:///widgets/temp')
      expect(registry.has('bl:///widgets/temp')).toBe(false)
    })
  })

  describe('late binding', () => {
    it('resolves pending get() calls when widget is registered', async () => {
      const pendingPromise = registry.get('bl:///widgets/late-button')

      // Register after get() is called
      registry.registerPrimitive('late-button', {
        type: 'bl:///types/widgets/atom/button',
        render: () => {},
      })

      const widget = await pendingPromise
      expect(widget).not.toBeNull()
      expect(widget.name).toBe('late-button')
    })
  })

  describe('listAll', () => {
    it('lists both primitives and custom widgets', () => {
      registry.registerPrimitive('button', {
        type: 'bl:///types/widgets/atom/button',
        render: () => {},
      })
      registry.registerCustom('bl:///widgets/my-button', {
        name: 'my-button',
        definition: ['button'],
      })

      const all = registry.listAll()
      expect(all).toContain('bl:///widgets/button')
      expect(all).toContain('bl:///widgets/my-button')
    })
  })
})

describe('Widget Compiler', () => {
  let registry
  let compile

  beforeEach(() => {
    registry = createWidgetRegistry()

    // Register some primitives for testing
    registry.registerPrimitive('box', {
      type: 'bl:///types/widgets/layout/box',
      props: { style: { type: 'object' } },
      render: () => {},
    })
    registry.registerPrimitive('stack', {
      type: 'bl:///types/widgets/layout/stack',
      props: { direction: { type: 'string' }, gap: { type: 'number' } },
      render: () => {},
    })
    registry.registerPrimitive('text', {
      type: 'bl:///types/widgets/atom/text',
      props: { content: { type: 'string' } },
      render: () => {},
    })
    registry.registerPrimitive('button', {
      type: 'bl:///types/widgets/atom/button',
      props: { label: { type: 'string' }, onClick: { type: 'string' } },
      render: () => {},
    })

    compile = createCompiler(registry)
  })

  describe('primitive resolution', () => {
    it('resolves simple primitive widget', () => {
      const tree = compile(['button', { label: 'Save' }])

      expect(tree.type).toBe('primitive')
      expect(tree.widget).toBe('bl:///widgets/button')
      expect(tree.name).toBe('button')
      expect(tree.props.label).toBe('Save')
    })

    it('resolves widget with children', () => {
      const tree = compile([
        'stack',
        { gap: 8 },
        ['button', { label: 'A' }],
        ['button', { label: 'B' }],
      ])

      expect(tree.type).toBe('primitive')
      expect(tree.name).toBe('stack')
      expect(tree.props.gap).toBe(8)
      expect(tree.children).toHaveLength(2)
      expect(tree.children[0].props.label).toBe('A')
      expect(tree.children[1].props.label).toBe('B')
    })

    it('resolves plain strings as text content', () => {
      const tree = compile(['box', {}, 'Hello world'])

      expect(tree.type).toBe('primitive')
      expect(tree.name).toBe('box')
      expect(tree.children).toHaveLength(1)
      expect(tree.children[0].type).toBe('text')
      expect(tree.children[0].content).toBe('Hello world')
    })
  })

  describe('custom widget resolution', () => {
    beforeEach(() => {
      registry.registerCustom('bl:///widgets/save-button', {
        name: 'save-button',
        definition: ['button', { label: 'Save', variant: 'primary' }],
      })
    })

    it('resolves custom widget by name', () => {
      const tree = compile(['save-button', {}])

      expect(tree.type).toBe('primitive')
      expect(tree.widget).toBe('bl:///widgets/button')
      expect(tree.props.label).toBe('Save')
      expect(tree.props.variant).toBe('primary')
    })

    it('resolves custom widget by full URI', () => {
      const tree = compile(['bl:///widgets/save-button', {}])

      expect(tree.type).toBe('primitive')
      expect(tree.props.label).toBe('Save')
    })
  })

  describe('prop interpolation', () => {
    beforeEach(() => {
      registry.registerCustom('bl:///widgets/labeled-button', {
        name: 'labeled-button',
        props: { label: { type: 'string' } },
        definition: ['button', { label: '$label' }],
      })
    })

    it('interpolates $propName references', () => {
      const tree = compile(['labeled-button', { label: 'Custom Label' }])

      expect(tree.props.label).toBe('Custom Label')
    })
  })

  describe('error handling', () => {
    it('returns error node for unknown widget', () => {
      const tree = compile(['unknown-widget', {}])

      expect(tree.type).toBe('error')
      expect(tree.message).toContain('Unknown widget')
    })

    it('prevents infinite recursion', () => {
      // Create a self-referencing widget (this would cause infinite recursion)
      registry.registerCustom('bl:///widgets/recursive', {
        name: 'recursive',
        definition: ['recursive', {}],
      })

      expect(() => compile(['recursive', {}])).toThrow(/too deeply nested/)
    })
  })
})

describe('Widget Routes', () => {
  let bl

  beforeEach(async () => {
    bl = new Bassline()
    installWidgets(bl)

    // Register some primitives for testing
    const widgets = await bl.getModule('widgets')
    widgets.registerPrimitive('button', {
      type: 'bl:///types/widgets/atom/button',
      props: { label: { type: 'string' } },
      render: () => {},
    })
    widgets.registerPrimitive('stack', {
      type: 'bl:///types/widgets/layout/stack',
      props: { gap: { type: 'number' } },
      render: () => {},
    })
  })

  describe('GET /widgets', () => {
    it('lists all widgets', async () => {
      const result = await bl.get('bl:///widgets')

      expect(result.headers.type).toBe('bl:///types/directory')
      expect(result.body.entries).toBeInstanceOf(Array)
      expect(result.body.entries.some((e) => e.name === 'button')).toBe(true)
    })
  })

  describe('GET /widgets/:name', () => {
    it('returns widget info', async () => {
      const result = await bl.get('bl:///widgets/button')

      expect(result.body.name).toBe('button')
      expect(result.body.primitive).toBe(true)
      expect(result.body.uri).toBe('bl:///widgets/button')
    })

    it('returns null for unknown widget', async () => {
      const result = await bl.get('bl:///widgets/unknown')
      expect(result).toBeNull()
    })
  })

  describe('GET /widgets/:name/definition', () => {
    it('returns primitive type for primitives', async () => {
      const result = await bl.get('bl:///widgets/button/definition')

      expect(result.headers.type).toBe('bl:///types/widget-definition')
      expect(result.body.type).toBe('primitive')
    })

    it('returns composed definition for custom widgets', async () => {
      // First create a custom widget
      await bl.put(
        'bl:///widgets/my-button',
        {},
        {
          name: 'my-button',
          definition: ['button', { label: 'Click' }],
        }
      )

      const result = await bl.get('bl:///widgets/my-button/definition')

      expect(result.body.type).toBe('composed')
      expect(result.body.definition).toEqual(['button', { label: 'Click' }])
    })
  })

  describe('PUT /widgets/:name', () => {
    it('creates a custom widget', async () => {
      const result = await bl.put(
        'bl:///widgets/save-button',
        {},
        {
          name: 'save-button',
          definition: ['button', { label: 'Save' }],
          description: 'A save button',
        }
      )

      expect(result.body.name).toBe('save-button')
      expect(result.body.primitive).toBe(false)

      // Verify it's retrievable
      const widget = await bl.get('bl:///widgets/save-button')
      expect(widget.body.name).toBe('save-button')
    })

    it('returns error when definition is missing', async () => {
      const result = await bl.put(
        'bl:///widgets/invalid',
        {},
        {
          name: 'invalid',
        }
      )

      expect(result.headers.type).toBe('bl:///types/error')
      expect(result.body.error).toContain('Missing required field: definition')
    })
  })

  describe('PUT /widgets/:name/delete', () => {
    it('deletes a custom widget', async () => {
      // Create first
      await bl.put(
        'bl:///widgets/temp',
        {},
        {
          name: 'temp',
          definition: ['box'],
        }
      )

      // Verify it exists
      expect(await bl.get('bl:///widgets/temp')).not.toBeNull()

      // Delete
      const result = await bl.put('bl:///widgets/temp/delete', {}, {})
      expect(result.headers.type).toBe('bl:///types/resource-removed')

      // Verify it's gone
      expect(await bl.get('bl:///widgets/temp')).toBeNull()
    })
  })
})

describe('installWidgets', () => {
  it('registers the widgets module', async () => {
    const bl = new Bassline()
    installWidgets(bl)

    const widgets = await bl.getModule('widgets')
    expect(widgets).toBeDefined()
    expect(widgets.registry).toBeDefined()
    expect(widgets.compile).toBeDefined()
    expect(widgets.registerPrimitive).toBeDefined()
    expect(widgets.registerCustom).toBeDefined()
  })
})
