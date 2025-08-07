import { describe, expect, test } from 'vitest'
import { grow, shrink, isGrowSet, isShrinkSet, isGrowArray, isShrinkArray, isGrowMap, isShrinkMap, getCollectionData, isEmptyCollection, serializeTaggedCollection, deserializeTaggedCollection } from '../collections'

describe('tagged collection constructors', () => {
  describe('grow collections', () => {
    test('grow.set creates GrowSet', () => {
      const growSet = grow.set([1, 2, 3])
      expect(growSet._tag).toBe('GrowSet')
      expect(growSet.values).toEqual(new Set([1, 2, 3]))
    })

    test('grow.set handles empty and no arguments', () => {
      expect(grow.set()).toEqual({ _tag: 'GrowSet', values: new Set() })
      expect(grow.set([])).toEqual({ _tag: 'GrowSet', values: new Set() })
    })

    test('grow.array creates GrowArray', () => {
      const growArray = grow.array([1, 2, 3])
      expect(growArray._tag).toBe('GrowArray')
      expect(growArray.items).toEqual([1, 2, 3])
    })

    test('grow.array handles empty and no arguments', () => {
      expect(grow.array()).toEqual({ _tag: 'GrowArray', items: [] })
      expect(grow.array([])).toEqual({ _tag: 'GrowArray', items: [] })
    })

    test('grow.map creates GrowMap', () => {
      const growMap = grow.map([['a', 1], ['b', 2]])
      expect(growMap._tag).toBe('GrowMap')
      expect(growMap.entries).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    test('grow.map handles empty and no arguments', () => {
      expect(grow.map()).toEqual({ _tag: 'GrowMap', entries: new Map() })
      expect(grow.map([])).toEqual({ _tag: 'GrowMap', entries: new Map() })
    })
  })

  describe('shrink collections', () => {
    test('shrink.set creates ShrinkSet', () => {
      const shrinkSet = shrink.set([1, 2, 3])
      expect(shrinkSet._tag).toBe('ShrinkSet')
      expect(shrinkSet.values).toEqual(new Set([1, 2, 3]))
    })

    test('shrink.array creates ShrinkArray', () => {
      const shrinkArray = shrink.array([1, 2, 3])
      expect(shrinkArray._tag).toBe('ShrinkArray')
      expect(shrinkArray.items).toEqual([1, 2, 3])
    })

    test('shrink.map creates ShrinkMap', () => {
      const shrinkMap = shrink.map([['a', 1], ['b', 2]])
      expect(shrinkMap._tag).toBe('ShrinkMap')
      expect(shrinkMap.entries).toEqual(new Map([['a', 1], ['b', 2]]))
    })
  })
})

describe('type guards', () => {
  test('isGrowSet identifies GrowSets correctly', () => {
    expect(isGrowSet(grow.set([1, 2, 3]))).toBe(true)
    expect(isGrowSet(shrink.set([1, 2, 3]))).toBe(false)
    expect(isGrowSet(new Set([1, 2, 3]))).toBe(false)
    expect(isGrowSet({ _tag: 'GrowSet', values: new Set() })).toBe(true)
    expect(isGrowSet(null)).toBe(false)
  })

  test('isShrinkSet identifies ShrinkSets correctly', () => {
    expect(isShrinkSet(shrink.set([1, 2, 3]))).toBe(true)
    expect(isShrinkSet(grow.set([1, 2, 3]))).toBe(false)
    expect(isShrinkSet(new Set([1, 2, 3]))).toBe(false)
  })

  test('isGrowArray identifies GrowArrays correctly', () => {
    expect(isGrowArray(grow.array([1, 2, 3]))).toBe(true)
    expect(isGrowArray(shrink.array([1, 2, 3]))).toBe(false)
    expect(isGrowArray([1, 2, 3])).toBe(false)
  })

  test('isShrinkArray identifies ShrinkArrays correctly', () => {
    expect(isShrinkArray(shrink.array([1, 2, 3]))).toBe(true)
    expect(isShrinkArray(grow.array([1, 2, 3]))).toBe(false)
    expect(isShrinkArray([1, 2, 3])).toBe(false)
  })

  test('isGrowMap identifies GrowMaps correctly', () => {
    expect(isGrowMap(grow.map([['a', 1]]))).toBe(true)
    expect(isGrowMap(shrink.map([['a', 1]]))).toBe(false)
    expect(isGrowMap(new Map([['a', 1]]))).toBe(false)
  })

  test('isShrinkMap identifies ShrinkMaps correctly', () => {
    expect(isShrinkMap(shrink.map([['a', 1]]))).toBe(true)
    expect(isShrinkMap(grow.map([['a', 1]]))).toBe(false)
    expect(isShrinkMap(new Map([['a', 1]]))).toBe(false)
  })
})

describe('helper functions', () => {
  test('getCollectionData extracts underlying data', () => {
    const growSet = grow.set([1, 2, 3])
    const shrinkArray = shrink.array([1, 2, 3])
    const growMap = grow.map([['a', 1]])
    
    expect(getCollectionData(growSet)).toEqual(new Set([1, 2, 3]))
    expect(getCollectionData(shrinkArray)).toEqual([1, 2, 3])
    expect(getCollectionData(growMap)).toEqual(new Map([['a', 1]]))
  })

  test('isEmptyCollection detects empty collections', () => {
    expect(isEmptyCollection(grow.set())).toBe(true)
    expect(isEmptyCollection(grow.set([1]))).toBe(false)
    expect(isEmptyCollection(shrink.array())).toBe(true)
    expect(isEmptyCollection(shrink.array([1]))).toBe(false)
    expect(isEmptyCollection(grow.map())).toBe(true)
    expect(isEmptyCollection(grow.map([['a', 1]]))).toBe(false)
  })
})

describe('serialization', () => {
  test('serializeTaggedCollection converts to plain objects', () => {
    const growSet = grow.set([1, 2, 3])
    const serialized = serializeTaggedCollection(growSet)
    
    expect(serialized).toEqual({
      _tag: 'GrowSet',
      values: [1, 2, 3] // Set converted to array
    })
  })

  test('serializeTaggedCollection handles arrays', () => {
    const growArray = grow.array([1, 2, 3])
    const serialized = serializeTaggedCollection(growArray)
    
    expect(serialized).toEqual({
      _tag: 'GrowArray',
      items: [1, 2, 3]
    })
  })

  test('serializeTaggedCollection handles maps', () => {
    const growMap = grow.map([['a', 1], ['b', 2]])
    const serialized = serializeTaggedCollection(growMap)
    
    expect(serialized).toEqual({
      _tag: 'GrowMap',
      entries: [['a', 1], ['b', 2]] // Map converted to array of entries
    })
  })

  test('deserializeTaggedCollection restores collections', () => {
    const originalSet = grow.set([1, 2, 3])
    const serialized = serializeTaggedCollection(originalSet)
    const deserialized = deserializeTaggedCollection(serialized)
    
    expect(deserialized).toEqual(originalSet)
  })

  test('deserializeTaggedCollection handles all types', () => {
    const collections = [
      grow.set([1, 2, 3]),
      shrink.set([1, 2, 3]),
      grow.array([1, 2, 3]),
      shrink.array([1, 2, 3]),
      grow.map([['a', 1], ['b', 2]]),
      shrink.map([['a', 1], ['b', 2]])
    ]
    
    for (const collection of collections) {
      const serialized = serializeTaggedCollection(collection)
      const deserialized = deserializeTaggedCollection(serialized)
      expect(deserialized).toEqual(collection)
    }
  })

  test('deserializeTaggedCollection throws on unknown type', () => {
    expect(() => {
      deserializeTaggedCollection({ _tag: 'UnknownType', data: [] })
    }).toThrow('Unknown tagged collection type: UnknownType')
  })
})

describe('immutability', () => {
  test('grow.array creates new array copy', () => {
    const original = [1, 2, 3]
    const growArray = grow.array(original)
    
    // Modify original
    original.push(4)
    
    // GrowArray should be unaffected
    expect(growArray.items).toEqual([1, 2, 3])
  })

  test('collections are independent of input data', () => {
    const inputSet = new Set([1, 2, 3])
    const growSet = grow.set(inputSet)
    
    // Modify input
    inputSet.add(4)
    
    // GrowSet should be unaffected
    expect(growSet.values).toEqual(new Set([1, 2, 3]))
  })
})