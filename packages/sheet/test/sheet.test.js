import { describe, it, expect } from 'vitest'
import { Sheet } from '../src/index.js'

describe('values', () => {
  it('put stores a value and returns an id', () => {
    const s = new Sheet()
    const id = s.put('hello')
    expect(typeof id).toBe('string')
    expect(s.resolve(id)).toBe('hello')
  })

  it('put stores numbers', () => {
    const s = new Sheet()
    const id = s.put(42)
    expect(s.resolve(id)).toBe(42)
  })

  it('resolve returns undefined for unknown id', () => {
    const s = new Sheet()
    expect(s.resolve('nope')).toBeUndefined()
  })

  it('update changes a value in place', () => {
    const s = new Sheet()
    const id = s.put('old')
    s.update(id, 'new')
    expect(s.resolve(id)).toBe('new')
  })
})

describe('cells', () => {
  it('set creates a value and points a cell to it', () => {
    const s = new Sheet()
    const id = s.set([0, 0], 'hello')
    expect(s.get([0, 0])).toBe('hello')
    expect(s.ref([0, 0])).toBe(id)
  })

  it('get returns undefined for empty cell', () => {
    const s = new Sheet()
    expect(s.get([5, 5])).toBeUndefined()
  })

  it('ref returns undefined for empty cell', () => {
    const s = new Sheet()
    expect(s.ref([5, 5])).toBeUndefined()
  })

  it('link points a cell to an existing value', () => {
    const s = new Sheet()
    const id = s.put('shared')
    s.link([0, 0], id)
    s.link([1, 1], id)
    expect(s.get([0, 0])).toBe('shared')
    expect(s.get([1, 1])).toBe('shared')
    expect(s.ref([0, 0])).toBe(s.ref([1, 1]))
  })

  it('clear removes a cell entry', () => {
    const s = new Sheet()
    s.set([0, 0], 'hello')
    s.clear([0, 0])
    expect(s.get([0, 0])).toBeUndefined()
    expect(s.ref([0, 0])).toBeUndefined()
  })

  it('set overwrites previous cell pointer', () => {
    const s = new Sheet()
    s.set([0, 0], 'first')
    s.set([0, 0], 'second')
    expect(s.get([0, 0])).toBe('second')
  })
})

describe('shared values (variables)', () => {
  it('multiple cells linked to same id share the value', () => {
    const s = new Sheet()
    const id = s.put(5000)
    s.link([0, 0], id)
    s.link([3, 5], id)
    s.link([7, 2], id)
    expect(s.get([0, 0])).toBe(5000)
    expect(s.get([3, 5])).toBe(5000)
    expect(s.get([7, 2])).toBe(5000)
  })

  it('updating a shared value reflects in all linked cells', () => {
    const s = new Sheet()
    const id = s.put(5000)
    s.link([0, 0], id)
    s.link([3, 5], id)
    s.update(id, 10000)
    expect(s.get([0, 0])).toBe(10000)
    expect(s.get([3, 5])).toBe(10000)
  })
})

describe('gc', () => {
  it('removes unreferenced values', () => {
    const s = new Sheet()
    const id1 = s.put('orphan')
    const id2 = s.set([0, 0], 'kept')
    s.gc()
    expect(s.resolve(id1)).toBeUndefined()
    expect(s.resolve(id2)).toBe('kept')
  })

  it('returns collected entries', () => {
    const s = new Sheet()
    s.put('a')
    s.put('b')
    s.set([0, 0], 'c')
    const collected = s.gc()
    expect(collected.length).toBe(2)
    expect(collected.map(c => c.value).sort()).toEqual(['a', 'b'])
  })

  it('emits gc event with collected values', () => {
    const s = new Sheet()
    const msgs = []
    s.put('orphan')
    s.on(m => msgs.push(m))
    s.gc()
    expect(msgs.length).toBe(1)
    expect(msgs[0].type).toBe('gc')
    expect(msgs[0].collected.length).toBe(1)
    expect(msgs[0].collected[0].value).toBe('orphan')
  })

  it('does not emit if nothing collected', () => {
    const s = new Sheet()
    const msgs = []
    s.set([0, 0], 'kept')
    s.on(m => msgs.push(m))
    s.gc()
    expect(msgs.length).toBe(0)
  })

  it('preserves values referenced by multiple cells', () => {
    const s = new Sheet()
    const id = s.put('shared')
    s.link([0, 0], id)
    s.link([1, 1], id)
    s.gc()
    expect(s.resolve(id)).toBe('shared')
  })

  it('collects values after cells are cleared', () => {
    const s = new Sheet()
    const id = s.set([0, 0], 'temp')
    s.clear([0, 0])
    const collected = s.gc()
    expect(collected.length).toBe(1)
    expect(collected[0].id).toBe(id)
    expect(s.resolve(id)).toBeUndefined()
  })
})

describe('selections', () => {
  it('stores and retrieves a named selection', () => {
    const s = new Sheet()
    const region = { r: [0, 5], c: [0, 3] }
    s.select('data', region)
    expect(s.selection('data')).toBe(region)
  })

  it('stores selections with metadata', () => {
    const s = new Sheet()
    const region = { r: [0, 0], c: [0, 10], role: 'header' }
    s.select('headers', region)
    expect(s.selection('headers').role).toBe('header')
  })

  it('returns undefined for unknown selection', () => {
    const s = new Sheet()
    expect(s.selection('nope')).toBeUndefined()
  })
})

describe('range iteration', () => {
  it('yields occupied cells in region', () => {
    const s = new Sheet()
    s.set([0, 0], 'a')
    s.set([1, 1], 'b')
    s.set([2, 2], 'c')
    s.set([5, 5], 'outside')

    const cells = [...s.range(0, 0, 2, 2)]
    expect(cells.length).toBe(3)
    expect(cells.map(c => c.value)).toEqual(['a', 'b', 'c'])
  })

  it('skips empty cells', () => {
    const s = new Sheet()
    s.set([0, 0], 'only')
    const cells = [...s.range(0, 0, 10, 10)]
    expect(cells.length).toBe(1)
  })

  it('yields nothing for empty region', () => {
    const s = new Sheet()
    const cells = [...s.range(0, 0, 10, 10)]
    expect(cells.length).toBe(0)
  })

  it('each entry has r, c, id, value', () => {
    const s = new Sheet()
    const vid = s.set([3, 4], 'test')
    const [entry] = [...s.range(3, 4, 3, 4)]
    expect(entry.r).toBe(3)
    expect(entry.c).toBe(4)
    expect(entry.id).toBe(vid)
    expect(entry.value).toBe('test')
  })
})

describe('entries iteration', () => {
  it('yields all occupied cells', () => {
    const s = new Sheet()
    s.set([0, 0], 'a')
    s.set([100, 200], 'b')
    const cells = [...s.entries()]
    expect(cells.length).toBe(2)
    expect(cells.map(c => c.value).sort()).toEqual(['a', 'b'])
  })
})

describe('events', () => {
  it('emits on set', () => {
    const s = new Sheet()
    const msgs = []
    s.on(m => msgs.push(m))
    const id = s.set([1, 2], 'hello')
    expect(msgs).toEqual([{ type: 'set', r: 1, c: 2, id }])
  })

  it('emits on link', () => {
    const s = new Sheet()
    const msgs = []
    const id = s.put('val')
    s.on(m => msgs.push(m))
    s.link([3, 4], id)
    expect(msgs).toEqual([{ type: 'link', r: 3, c: 4, id }])
  })

  it('emits on clear', () => {
    const s = new Sheet()
    const msgs = []
    s.set([0, 0], 'x')
    s.on(m => msgs.push(m))
    s.clear([0, 0])
    expect(msgs).toEqual([{ type: 'clear', r: 0, c: 0 }])
  })

  it('emits on update', () => {
    const s = new Sheet()
    const msgs = []
    const id = s.put('old')
    s.on(m => msgs.push(m))
    s.update(id, 'new')
    expect(msgs).toEqual([{ type: 'update', id, value: 'new' }])
  })

  it('emits on select', () => {
    const s = new Sheet()
    const msgs = []
    s.on(m => msgs.push(m))
    const region = { r: [0, 5], c: [0, 3] }
    s.select('data', region)
    expect(msgs).toEqual([{ type: 'select', name: 'data', region }])
  })

  it('unsubscribe stops events', () => {
    const s = new Sheet()
    const msgs = []
    const unsub = s.on(m => msgs.push(m))
    s.set([0, 0], 'a')
    unsub()
    s.set([1, 1], 'b')
    expect(msgs.length).toBe(1)
  })

  it('multiple listeners all receive events', () => {
    const s = new Sheet()
    const a = [],
      b = []
    s.on(m => a.push(m))
    s.on(m => b.push(m))
    s.set([0, 0], 'x')
    expect(a.length).toBe(1)
    expect(b.length).toBe(1)
  })
})

describe('serialization', () => {
  it('toJSON produces values, cells, selections', () => {
    const s = new Sheet()
    s.set([0, 0], 'hello')
    s.select('test', { r: [0, 0], c: [0, 0] })
    const json = s.toJSON()
    expect(json.values).toBeDefined()
    expect(json.cells).toBeDefined()
    expect(json.selections).toBeDefined()
  })

  it('cells serialize as [r, c, valueId] triples', () => {
    const s = new Sheet()
    const id = s.set([3, 7], 'test')
    const json = s.toJSON()
    expect(json.cells).toEqual([[3, 7, id]])
  })

  it('round-trips through JSON', () => {
    const s = new Sheet()
    const id1 = s.set([0, 0], 'hello')
    s.set([1, 1], 42)
    s.link([2, 2], id1) // shared with [0, 0]
    s.select('data', { r: [0, 5], c: [0, 3], role: 'main' })

    const restored = Sheet.fromJSON(JSON.stringify(s))

    expect(restored.get([0, 0])).toBe('hello')
    expect(restored.get([1, 1])).toBe(42)
    expect(restored.get([2, 2])).toBe('hello')
    expect(restored.ref([0, 0])).toBe(restored.ref([2, 2])) // shared pointer preserved
    expect(restored.selection('data').role).toBe('main')
  })

  it('fromJSON accepts parsed object', () => {
    const s = new Sheet()
    s.set([0, 0], 'test')
    const restored = Sheet.fromJSON(s.toJSON())
    expect(restored.get([0, 0])).toBe('test')
  })

  it('works with JSON.stringify', () => {
    const s = new Sheet()
    s.set([0, 0], 'test')
    const str = JSON.stringify(s)
    const parsed = JSON.parse(str)
    expect(parsed.cells.length).toBe(1)
  })
})
