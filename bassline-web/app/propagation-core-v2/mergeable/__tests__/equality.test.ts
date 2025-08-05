import { structuralEquals } from '../equality'
import { grow, shrink } from '../collections'

describe('structuralEquals', () => {
  describe('primitives', () => {
    test('identical primitives are equal', () => {
      expect(structuralEquals(5, 5)).toBe(true)
      expect(structuralEquals('hello', 'hello')).toBe(true)
      expect(structuralEquals(true, true)).toBe(true)
      expect(structuralEquals(null, null)).toBe(true)
      expect(structuralEquals(undefined, undefined)).toBe(true)
    })

    test('different primitives are not equal', () => {
      expect(structuralEquals(5, 6)).toBe(false)
      expect(structuralEquals('hello', 'world')).toBe(false)
      expect(structuralEquals(true, false)).toBe(false)
      expect(structuralEquals(null, undefined)).toBe(false)
    })

    test('different types are not equal', () => {
      expect(structuralEquals(5, '5')).toBe(false)
      expect(structuralEquals(0, false)).toBe(false)
      expect(structuralEquals('', false)).toBe(false)
    })
  })

  describe('arrays', () => {
    test('identical arrays are equal', () => {
      expect(structuralEquals([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(structuralEquals([], [])).toBe(true)
      expect(structuralEquals(['a', 'b'], ['a', 'b'])).toBe(true)
    })

    test('different arrays are not equal', () => {
      expect(structuralEquals([1, 2, 3], [1, 2, 4])).toBe(false)
      expect(structuralEquals([1, 2], [1, 2, 3])).toBe(false)
      expect(structuralEquals(['a'], ['b'])).toBe(false)
    })

    test('nested arrays', () => {
      expect(structuralEquals([[1, 2], [3, 4]], [[1, 2], [3, 4]])).toBe(true)
      expect(structuralEquals([[1, 2], [3, 4]], [[1, 2], [3, 5]])).toBe(false)
    })
  })

  describe('sets', () => {
    test('identical sets are equal', () => {
      expect(structuralEquals(new Set([1, 2, 3]), new Set([1, 2, 3]))).toBe(true)
      expect(structuralEquals(new Set([1, 2, 3]), new Set([3, 2, 1]))).toBe(true) // Order doesn't matter
      expect(structuralEquals(new Set(), new Set())).toBe(true)
    })

    test('different sets are not equal', () => {
      expect(structuralEquals(new Set([1, 2, 3]), new Set([1, 2, 4]))).toBe(false)
      expect(structuralEquals(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false)
    })
  })

  describe('maps', () => {
    test('identical maps are equal', () => {
      const map1 = new Map([['a', 1], ['b', 2]])
      const map2 = new Map([['a', 1], ['b', 2]])
      const map3 = new Map([['b', 2], ['a', 1]]) // Order doesn't matter
      
      expect(structuralEquals(map1, map2)).toBe(true)
      expect(structuralEquals(map1, map3)).toBe(true)
      expect(structuralEquals(new Map(), new Map())).toBe(true)
    })

    test('different maps are not equal', () => {
      const map1 = new Map([['a', 1], ['b', 2]])
      const map2 = new Map([['a', 1], ['b', 3]])
      const map3 = new Map([['a', 1]])
      
      expect(structuralEquals(map1, map2)).toBe(false)
      expect(structuralEquals(map1, map3)).toBe(false)
    })

    test('nested maps', () => {
      const map1 = new Map([['nested', new Map([['x', 1]])]])
      const map2 = new Map([['nested', new Map([['x', 1]])]])
      const map3 = new Map([['nested', new Map([['x', 2]])]])
      
      expect(structuralEquals(map1, map2)).toBe(true)
      expect(structuralEquals(map1, map3)).toBe(false)
    })
  })

  describe('tagged collections', () => {
    test('identical GrowSets are equal', () => {
      const set1 = grow.set([1, 2, 3])
      const set2 = grow.set([1, 2, 3])
      expect(structuralEquals(set1, set2)).toBe(true)
    })

    test('different GrowSets are not equal', () => {
      const set1 = grow.set([1, 2, 3])
      const set2 = grow.set([1, 2, 4])
      expect(structuralEquals(set1, set2)).toBe(false)
    })

    test('different tagged collection types are not equal', () => {
      const growSet = grow.set([1, 2, 3])
      const shrinkSet = shrink.set([1, 2, 3])
      expect(structuralEquals(growSet, shrinkSet)).toBe(false)
    })

    test('identical GrowArrays are equal', () => {
      const arr1 = grow.array([1, 2, 3])
      const arr2 = grow.array([1, 2, 3])
      expect(structuralEquals(arr1, arr2)).toBe(true)
    })

    test('identical GrowMaps are equal', () => {
      const map1 = grow.map([['a', 1], ['b', 2]])
      const map2 = grow.map([['a', 1], ['b', 2]])
      expect(structuralEquals(map1, map2)).toBe(true)
    })
  })

  describe('plain objects', () => {
    test('identical objects are equal', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 2 }
      const obj3 = { b: 2, a: 1 } // Different order
      
      expect(structuralEquals(obj1, obj2)).toBe(true)
      expect(structuralEquals(obj1, obj3)).toBe(true)
    })

    test('different objects are not equal', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 3 }
      const obj3 = { a: 1 }
      
      expect(structuralEquals(obj1, obj2)).toBe(false)
      expect(structuralEquals(obj1, obj3)).toBe(false)
    })

    test('nested objects', () => {
      const obj1 = { nested: { x: 1, y: 2 } }
      const obj2 = { nested: { x: 1, y: 2 } }
      const obj3 = { nested: { x: 1, y: 3 } }
      
      expect(structuralEquals(obj1, obj2)).toBe(true)
      expect(structuralEquals(obj1, obj3)).toBe(false)
    })
  })

  describe('mixed types', () => {
    test('array vs set with same values are not equal', () => {
      expect(structuralEquals([1, 2, 3], new Set([1, 2, 3]))).toBe(false)
    })

    test('object vs map with same entries are not equal', () => {
      const obj = { a: 1, b: 2 }
      const map = new Map([['a', 1], ['b', 2]])
      expect(structuralEquals(obj, map)).toBe(false)
    })

    test('tagged vs untagged collections are not equal', () => {
      const growSet = grow.set([1, 2, 3])
      const plainSet = new Set([1, 2, 3])
      expect(structuralEquals(growSet, plainSet)).toBe(false)
    })
  })
})