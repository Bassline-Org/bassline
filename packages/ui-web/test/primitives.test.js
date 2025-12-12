import { describe, it, expect, beforeEach } from 'vitest'
import { createWidgetRegistry } from '@bassline/widgets'
import { registerLayoutPrimitives } from '../src/primitives/layout.jsx'
import { registerAtomPrimitives } from '../src/primitives/atoms.jsx'
import { registerWebPrimitives } from '../src/index.jsx'

describe('Layout Primitives', () => {
  let registry

  beforeEach(() => {
    registry = createWidgetRegistry()
  })

  it('registers all layout primitives', () => {
    registerLayoutPrimitives(registry)

    expect(registry.has('bl:///widgets/box')).toBe(true)
    expect(registry.has('bl:///widgets/stack')).toBe(true)
    expect(registry.has('bl:///widgets/grid')).toBe(true)
    expect(registry.has('bl:///widgets/scroll')).toBe(true)
    expect(registry.has('bl:///widgets/center')).toBe(true)
  })

  it('layout primitives have render functions', () => {
    registerLayoutPrimitives(registry)

    const box = registry.getSync('bl:///widgets/box')
    expect(typeof box.render).toBe('function')

    const stack = registry.getSync('bl:///widgets/stack')
    expect(typeof stack.render).toBe('function')
  })

  it('layout primitives have correct types', () => {
    registerLayoutPrimitives(registry)

    expect(registry.getSync('bl:///widgets/box').type).toBe('bl:///types/widgets/layout/box')
    expect(registry.getSync('bl:///widgets/stack').type).toBe('bl:///types/widgets/layout/stack')
    expect(registry.getSync('bl:///widgets/grid').type).toBe('bl:///types/widgets/layout/grid')
  })
})

describe('Atom Primitives', () => {
  let registry

  beforeEach(() => {
    registry = createWidgetRegistry()
  })

  it('registers all atom primitives', () => {
    registerAtomPrimitives(registry)

    expect(registry.has('bl:///widgets/text')).toBe(true)
    expect(registry.has('bl:///widgets/heading')).toBe(true)
    expect(registry.has('bl:///widgets/button')).toBe(true)
    expect(registry.has('bl:///widgets/input')).toBe(true)
    expect(registry.has('bl:///widgets/checkbox')).toBe(true)
    expect(registry.has('bl:///widgets/select')).toBe(true)
    expect(registry.has('bl:///widgets/badge')).toBe(true)
    expect(registry.has('bl:///widgets/spinner')).toBe(true)
    expect(registry.has('bl:///widgets/divider')).toBe(true)
  })

  it('atom primitives have render functions', () => {
    registerAtomPrimitives(registry)

    const button = registry.getSync('bl:///widgets/button')
    expect(typeof button.render).toBe('function')

    const input = registry.getSync('bl:///widgets/input')
    expect(typeof input.render).toBe('function')
  })

  it('button has onClick port prop', () => {
    registerAtomPrimitives(registry)

    const button = registry.getSync('bl:///widgets/button')
    expect(button.props.onClick.type).toBe('port')
  })

  it('input has onChange port prop', () => {
    registerAtomPrimitives(registry)

    const input = registry.getSync('bl:///widgets/input')
    expect(input.props.onChange.type).toBe('port')
  })
})

describe('registerWebPrimitives', () => {
  it('registers all primitives at once', () => {
    const registry = createWidgetRegistry()
    registerWebPrimitives(registry)

    // Layout
    expect(registry.has('bl:///widgets/box')).toBe(true)
    expect(registry.has('bl:///widgets/stack')).toBe(true)
    expect(registry.has('bl:///widgets/grid')).toBe(true)

    // Atoms
    expect(registry.has('bl:///widgets/text')).toBe(true)
    expect(registry.has('bl:///widgets/button')).toBe(true)
    expect(registry.has('bl:///widgets/input')).toBe(true)

    // Count total
    const primitives = registry.listPrimitives()
    expect(primitives.length).toBe(14) // 5 layout + 9 atoms
  })
})
