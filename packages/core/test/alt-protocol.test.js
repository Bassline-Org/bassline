import { describe, it, expect } from 'vitest'
import { spec, conforms, coreSpec, selector, resource, adapt, DNU } from '../src/alt/index.js'

describe('selector', () => {
  it('produces selector from message keys', () => {
    expect(selector({ at: 'x' })).toBe('at:')
    expect(selector({ at: 'x', put: 42 })).toBe('at:put:')
    expect(selector({ watch: 'w' })).toBe('watch:')
  })

  it('sorts keys alphabetically', () => {
    expect(selector({ z: 1, a: 2, m: 3 })).toBe('a:m:z:')
    expect(selector({ put: 1, at: 2 })).toBe('at:put:')
  })

  it('empty message produces empty string', () => {
    expect(selector({})).toBe('')
  })

  it('single key produces key:', () => {
    expect(selector({ foo: 'bar' })).toBe('foo:')
  })
})

describe('coreSpec', () => {
  it('has name and version', () => {
    expect(coreSpec.name).toBe('@bassline/core')
    expect(coreSpec.version).toBe('1.0.0')
  })

  it('has protocols with get/put arrays', () => {
    expect(coreSpec.protocols).toBeDefined()
    expect(coreSpec.protocols.Slot.get).toEqual([''])
    expect(coreSpec.protocols.Slot.put).toEqual([''])
    expect(coreSpec.protocols.Slots.get).toEqual(['at:', 'at:ifAbsentPut:'])
    expect(coreSpec.protocols.Slots.put).toEqual(['at:'])
  })

  it('Watchable extends Slot', () => {
    expect(coreSpec.protocols.Watchable.extends).toEqual(['Slot'])
    expect(coreSpec.protocols.Watchable.get).toEqual(['watch:', 'unwatch:'])
  })

  it('has no shapes section', () => {
    expect(coreSpec.shapes).toBeUndefined()
  })
})

describe('spec', () => {
  it('returns a resource', () => {
    const s = spec(coreSpec)
    expect(typeof s).toBe('function')
  })

  it('returns full data when called with no args', () => {
    const s = spec(coreSpec)
    const data = s()
    expect(data.name).toBe('@bassline/core')
    expect(data.version).toBe('1.0.0')
    expect(data.protocols).toBeDefined()
  })

  it('returns name', () => {
    const s = spec(coreSpec)
    expect(s({ name: true })).toBe('@bassline/core')
  })

  it('returns version', () => {
    const s = spec(coreSpec)
    expect(s({ version: true })).toBe('1.0.0')
  })

  it('returns all protocols', () => {
    const s = spec(coreSpec)
    const protocols = s({ protocols: true })
    expect(protocols.Slot).toBeDefined()
    expect(protocols.Slots).toBeDefined()
    expect(protocols.Watchable).toBeDefined()
  })

  it('resolves a protocol by name', () => {
    const s = spec(coreSpec)
    const slot = s({ protocol: 'Slot' })
    expect(slot.get).toEqual([''])
    expect(slot.put).toEqual([''])
  })

  it('returns undefined for unknown protocol', () => {
    const s = spec(coreSpec)
    expect(s({ protocol: 'Nonexistent' })).toBeUndefined()
  })
})

describe('spec — protocol resolution', () => {
  it('resolves Slot protocol', () => {
    const s = spec(coreSpec)
    const proto = s({ protocol: 'Slot' })
    expect(proto.get).toEqual([''])
    expect(proto.put).toEqual([''])
  })

  it('resolves Slots protocol', () => {
    const s = spec(coreSpec)
    const proto = s({ protocol: 'Slots' })
    expect(proto.get).toEqual(['at:', 'at:ifAbsentPut:'])
    expect(proto.put).toEqual(['at:'])
  })

  it('resolves Watchable with inherited Slot selectors', () => {
    const s = spec(coreSpec)
    const proto = s({ protocol: 'Watchable' })
    // Inherited from Slot
    expect(proto.get).toContain('')
    expect(proto.put).toContain('')
    // Own selectors
    expect(proto.get).toContain('watch:')
    expect(proto.get).toContain('unwatch:')
  })

  it('resolved protocol omits extends', () => {
    const s = spec(coreSpec)
    const proto = s({ protocol: 'Watchable' })
    expect(proto.extends).toBeUndefined()
  })

  it('transitive inheritance (C extends B extends A)', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        A: { get: ['a:'] },
        B: { extends: ['A'], get: ['b:'] },
        C: { extends: ['B'], get: ['c:'] },
      },
    }
    const s = spec(data)
    const proto = s({ protocol: 'C' })
    expect(proto.get.sort()).toEqual(['a:', 'b:', 'c:'])
  })

  it('multiple parents', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        X: { get: ['x:'] },
        Y: { get: ['y:'] },
        Z: { extends: ['X', 'Y'], get: ['z:'] },
      },
    }
    const s = spec(data)
    const proto = s({ protocol: 'Z' })
    expect(proto.get.sort()).toEqual(['x:', 'y:', 'z:'])
  })

  it('diamond inheritance deduplicates selectors', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        A: { get: ['a:'], put: ['a:'] },
        B: { extends: ['A'], get: ['b:'] },
        C: { extends: ['A'], get: ['c:'] },
        D: { extends: ['B', 'C'], get: ['d:'] },
      },
    }
    const s = spec(data)
    const proto = s({ protocol: 'D' })
    // 'a:' from A should appear only once despite diamond
    expect(proto.get.filter(s => s === 'a:')).toHaveLength(1)
    expect(proto.get.sort()).toEqual(['a:', 'b:', 'c:', 'd:'])
    expect(proto.put).toEqual(['a:'])
  })

  it('circular extends protection', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        X: { extends: ['Y'], get: ['x:'] },
        Y: { extends: ['X'], get: ['y:'] },
      },
    }
    const s = spec(data)
    // Should not throw — returns partial result
    const proto = s({ protocol: 'X' })
    expect(proto).toBeDefined()
    expect(proto.get).toContain('x:')
  })
})

describe('conforms', () => {
  it('matches a Slots get message', () => {
    const s = spec(coreSpec)
    const result = conforms({ at: 'users' }, 'Slots', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('at:')
    expect(result.dispatch).toBe('get')
  })

  it('matches a Slots put message', () => {
    const s = spec(coreSpec)
    const result = conforms({ at: 'users', put: 'alice' }, 'Slots', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('at:')
    expect(result.dispatch).toBe('put')
  })

  it('matches Slot get (empty message)', () => {
    const s = spec(coreSpec)
    const result = conforms({}, 'Slot', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('')
    expect(result.dispatch).toBe('get')
  })

  it('matches Slot put', () => {
    const s = spec(coreSpec)
    const result = conforms({ put: 42 }, 'Slot', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('')
    expect(result.dispatch).toBe('put')
  })

  it('matches Watchable watch message', () => {
    const s = spec(coreSpec)
    const watcher = resource({ put() {} })
    const result = conforms({ watch: watcher }, 'Watchable', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('watch:')
    expect(result.dispatch).toBe('get')
  })

  it('matches Watchable unwatch message', () => {
    const s = spec(coreSpec)
    const watcher = resource({ put() {} })
    const result = conforms({ unwatch: watcher }, 'Watchable', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('unwatch:')
    expect(result.dispatch).toBe('get')
  })

  it('fails for unknown protocol', () => {
    const s = spec(coreSpec)
    const result = conforms({}, 'Unknown', s)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('unknown protocol')
  })

  it('fails for no matching selector', () => {
    const s = spec(coreSpec)
    const result = conforms({ foo: 'bar' }, 'Slots', s)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no matching selector')
  })
})

describe('spec — application specs extend the core', () => {
  it('application spec inherits and extends core protocols', () => {
    const exchangeSpec = {
      name: '@betherscan/exchange',
      version: '0.1.0',
      protocols: {
        ...coreSpec.protocols,
        Space: {
          get: ['match:', 'take:'],
          put: [''],
        },
      },
    }

    const s = spec(exchangeSpec)
    expect(s({ name: true })).toBe('@betherscan/exchange')
    expect(s({ version: true })).toBe('0.1.0')

    // Core protocols still available
    expect(s({ protocol: 'Slot' })).toBeDefined()

    // New protocol
    const space = s({ protocol: 'Space' })
    expect(space.get).toEqual(['match:', 'take:'])
    expect(space.put).toEqual([''])

    // conforms works with extended spec
    const result = conforms({ match: { name: 'alice' } }, 'Space', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('match:')
    expect(result.dispatch).toBe('get')
  })
})

describe('spec — validation adapter pattern', () => {
  it('validates messages before forwarding via adapt', () => {
    const s = spec(coreSpec)
    const target = resource({
      data: {},
      get(msg) { return this.data[msg.at] },
      put(value, msg) { this.data[msg.at] = value; return value },
    })

    const validated = adapt(target, {
      input(msg) {
        const result = conforms(msg, 'Slots', s)
        if (!result.ok) throw new Error(result.error)
        return msg
      },
    })

    // Valid messages pass through
    validated({ at: 'x', put: 42 })
    expect(validated({ at: 'x' })).toBe(42)

    // Invalid message throws
    expect(() => validated({ foo: 'bar' })).toThrow('no matching selector')
  })
})

describe('spec — selector normalization', () => {
  it('normalizes reversed selectors in protocol definitions', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        Dict: {
          get: ['ifAbsentPut:at:'],
          put: ['at:'],
        },
      },
    }
    const s = spec(data)
    const proto = s({ protocol: 'Dict' })
    expect(proto.get).toEqual(['at:ifAbsentPut:'])

    // conforms matches the normalized selector
    const result = conforms({ at: 'x', ifAbsentPut: () => 42 }, 'Dict', s)
    expect(result.ok).toBe(true)
    expect(result.selector).toBe('at:ifAbsentPut:')
  })

  it('diamond inheritance deduplicates after normalization', () => {
    const data = {
      name: 'test',
      version: '0.0.0',
      protocols: {
        A: { get: ['at:put:'] },
        B: { extends: ['A'], get: ['put:at:'] },
      },
    }
    const s = spec(data)
    const proto = s({ protocol: 'B' })
    // Both orderings collapse to one normalized selector
    expect(proto.get).toEqual(['at:put:'])
  })
})

describe('spec — empty spec', () => {
  it('handles spec with no protocols', () => {
    const s = spec({ name: 'empty', version: '0.0.0' })
    expect(s({ protocols: true })).toEqual({})
    expect(s({ protocol: 'Anything' })).toBeUndefined()
  })
})

describe('spec — read-only', () => {
  it('put throws DNU', () => {
    const s = spec(coreSpec)
    expect(() => s({ put: 'anything' })).toThrow(DNU)
  })
})
