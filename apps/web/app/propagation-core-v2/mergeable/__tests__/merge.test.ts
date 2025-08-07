import { mergeContent } from '../merge'
import { Contradiction } from '../index'
import { grow, shrink } from '../collections'

describe('mergeContent', () => {
  describe('null/undefined handling', () => {
    test('null/undefined with value returns value', async () => {
      expect(await mergeContent(null, 42)).toBe(42)
      expect(await mergeContent(undefined, 'hello')).toBe('hello')
      expect(await mergeContent(42, null)).toBe(42)
      expect(await mergeContent('hello', undefined)).toBe('hello')
    })

    test('both null/undefined returns the second value', async () => {
      expect(await mergeContent(null, null)).toBe(null)
      expect(await mergeContent(undefined, undefined)).toBe(undefined)
      expect(await mergeContent(null, undefined)).toBe(undefined)
      expect(await mergeContent(undefined, null)).toBe(null)
    })
  })

  describe('structural equality', () => {
    test('identical values return first value', async () => {
      expect(await mergeContent(42, 42)).toBe(42)
      expect(await mergeContent('hello', 'hello')).toBe('hello')
      expect(await mergeContent(true, true)).toBe(true)
    })

    test('identical arrays return first array', async () => {
      const arr1 = [1, 2, 3]
      const arr2 = [1, 2, 3]
      const result = await mergeContent(arr1, arr2)
      expect(result).toBe(arr1) // Should return first array
    })

    test('identical sets return first set', async () => {
      const set1 = new Set([1, 2, 3])
      const set2 = new Set([1, 2, 3])
      const result = await mergeContent(set1, set2)
      expect(result).toBe(set1)
    })
  })

  describe('scalar contradictions', () => {
    test('different scalars throw contradiction', async () => {
      await expect(mergeContent(42, 43)).rejects.toThrow(Contradiction)
      await expect(mergeContent('hello', 'world')).rejects.toThrow(Contradiction)
      await expect(mergeContent(true, false)).rejects.toThrow(Contradiction)
    })

    test('different types throw contradiction', async () => {
      await expect(mergeContent(42, 'hello')).rejects.toThrow(Contradiction)
      await expect(mergeContent(true, 1)).rejects.toThrow(Contradiction)
      await expect(mergeContent('hello', [])).rejects.toThrow(Contradiction)
    })
  })

  describe('GrowSet merging', () => {
    test('GrowSets merge via union', async () => {
      const set1 = grow.set([1, 2, 3])
      const set2 = grow.set([3, 4, 5])
      const result = await mergeContent(set1, set2) as any
      
      expect(result._tag).toBe('GrowSet')
      expect(result.values).toEqual(new Set([1, 2, 3, 4, 5]))
    })

    test('empty GrowSets merge correctly', async () => {
      const set1 = grow.set()
      const set2 = grow.set([1, 2])
      const result = await mergeContent(set1, set2) as any
      
      expect(result._tag).toBe('GrowSet')
      expect(result.values).toEqual(new Set([1, 2]))
    })

    test('GrowSet with plain Set merges correctly', async () => {
      const growSet = grow.set([1, 2])
      const plainSet = new Set([2, 3])
      const result = await mergeContent(growSet, plainSet) as any
      
      expect(result._tag).toBe('GrowSet')
      expect(result.values).toEqual(new Set([1, 2, 3]))
    })
  })

  describe('ShrinkSet merging', () => {
    test('ShrinkSets merge via intersection', async () => {
      const set1 = shrink.set([1, 2, 3, 4])
      const set2 = shrink.set([3, 4, 5, 6])
      const result = await mergeContent(set1, set2) as any
      
      expect(result._tag).toBe('ShrinkSet')
      expect(result.values).toEqual(new Set([3, 4]))
    })

    test('ShrinkSets with no intersection throw contradiction', async () => {
      const set1 = shrink.set([1, 2])
      const set2 = shrink.set([3, 4])
      
      await expect(mergeContent(set1, set2)).rejects.toThrow(Contradiction)
    })

    test('ShrinkSet with plain Set intersects correctly', async () => {
      const shrinkSet = shrink.set([1, 2, 3])
      const plainSet = new Set([2, 3, 4])
      const result = await mergeContent(shrinkSet, plainSet) as any
      
      expect(result._tag).toBe('ShrinkSet')
      expect(result.values).toEqual(new Set([2, 3]))
    })
  })

  describe('GrowArray merging', () => {
    test('GrowArrays merge via concatenation', async () => {
      const arr1 = grow.array([1, 2])
      const arr2 = grow.array([3, 4])
      const result = await mergeContent(arr1, arr2) as any
      
      expect(result._tag).toBe('GrowArray')
      expect(result.items).toEqual([1, 2, 3, 4])
    })

    test('GrowArray with plain array concatenates correctly', async () => {
      const growArray = grow.array([1, 2])
      const plainArray = [3, 4]
      const result = await mergeContent(growArray, plainArray) as any
      
      expect(result._tag).toBe('GrowArray')
      expect(result.items).toEqual([1, 2, 3, 4])
    })
  })

  describe('ShrinkArray merging', () => {
    test('ShrinkArrays merge via intersection', async () => {
      const arr1 = shrink.array([1, 2, 3, 2]) // Duplicates allowed
      const arr2 = shrink.array([2, 3, 4])
      const result = await mergeContent(arr1, arr2) as any
      
      expect(result._tag).toBe('ShrinkArray')
      expect(result.items).toEqual([2, 3]) // Unique intersection
    })

    test('ShrinkArrays with no intersection throw contradiction', async () => {
      const arr1 = shrink.array([1, 2])
      const arr2 = shrink.array([3, 4])
      
      await expect(mergeContent(arr1, arr2)).rejects.toThrow(Contradiction)
    })
  })

  describe('GrowMap merging', () => {
    test('GrowMaps merge recursively', async () => {
      const map1 = grow.map([['a', 1], ['b', 2]])
      const map2 = grow.map([['b', 3], ['c', 4]])
      
      // Note: This should throw because 2 !== 3 for key 'b'
      await expect(mergeContent(map1, map2)).rejects.toThrow(Contradiction)
    })

    test('GrowMaps with different keys merge correctly', async () => {
      const map1 = grow.map([['a', 1]])
      const map2 = grow.map([['b', 2]])
      const result = await mergeContent(map1, map2) as any
      
      expect(result._tag).toBe('GrowMap')
      expect(result.entries).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    test('GrowMaps with same values for same keys merge correctly', async () => {
      const map1 = grow.map([['a', 1], ['b', 2]])
      const map2 = grow.map([['a', 1], ['c', 3]])
      const result = await mergeContent(map1, map2) as any
      
      expect(result._tag).toBe('GrowMap')
      expect(result.entries).toEqual(new Map([['a', 1], ['b', 2], ['c', 3]]))
    })

    test('GrowMaps with nested mergeable values', async () => {
      const map1 = grow.map([['tags', grow.set([1, 2])]])
      const map2 = grow.map([['tags', grow.set([2, 3])]])
      const result = await mergeContent(map1, map2) as any
      
      expect(result._tag).toBe('GrowMap')
      const tags = result.entries.get('tags')
      expect(tags._tag).toBe('GrowSet')
      expect(tags.values).toEqual(new Set([1, 2, 3]))
    })
  })

  describe('ShrinkMap merging', () => {
    test('ShrinkMaps keep only common keys', async () => {
      const map1 = shrink.map([['a', 1], ['b', 2], ['c', 3]])
      const map2 = shrink.map([['a', 1], ['b', 2], ['d', 4]])
      const result = await mergeContent(map1, map2) as any
      
      expect(result._tag).toBe('ShrinkMap')
      expect(result.entries).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    test('ShrinkMaps with no common keys throw contradiction', async () => {
      const map1 = shrink.map([['a', 1]])
      const map2 = shrink.map([['b', 2]])
      
      await expect(mergeContent(map1, map2)).rejects.toThrow(Contradiction)
    })

    test('ShrinkMaps with conflicting values for same key throw contradiction', async () => {
      const map1 = shrink.map([['a', 1]])
      const map2 = shrink.map([['a', 2]])
      
      await expect(mergeContent(map1, map2)).rejects.toThrow(Contradiction)
    })
  })

  describe('plain JavaScript collections (legacy)', () => {
    test('plain Sets merge via union', async () => {
      const set1 = new Set([1, 2])
      const set2 = new Set([2, 3])
      const result = await mergeContent(set1, set2) as Set<number>
      
      expect(result).toEqual(new Set([1, 2, 3]))
    })

    test('plain Maps merge recursively', async () => {
      const map1 = new Map([['a', 1]])
      const map2 = new Map([['b', 2]])
      const result = await mergeContent(map1, map2) as Map<string, number>
      
      expect(result).toEqual(new Map([['a', 1], ['b', 2]]))
    })

    test('plain arrays concatenate', async () => {
      const arr1 = [1, 2]
      const arr2 = [3, 4]
      const result = await mergeContent(arr1, arr2) as number[]
      
      expect(result).toEqual([1, 2, 3, 4])
    })
  })

  describe('mixed type errors', () => {
    test('different tagged collection types throw contradiction', async () => {
      const growSet = grow.set([1, 2])
      const shrinkSet = shrink.set([1, 2])
      
      await expect(mergeContent(growSet, shrinkSet)).rejects.toThrow(Contradiction)
    })

    test('tagged collection with incompatible type throws contradiction', async () => {
      const growSet = grow.set([1, 2])
      const plainArray = [1, 2]
      
      await expect(mergeContent(growSet, plainArray)).rejects.toThrow(Contradiction)
    })
  })

  describe('error messages', () => {
    test('contradiction contains meaningful error message', async () => {
      try {
        await mergeContent(42, 43)
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Contradiction)
        expect((error as Contradiction).reason).toBe('Values cannot be merged')
        expect((error as Contradiction).leftValue).toBe(42)
        expect((error as Contradiction).rightValue).toBe(43)
      }
    })

    test('empty intersection contradiction has specific message', async () => {
      try {
        const set1 = shrink.set([1, 2])
        const set2 = shrink.set([3, 4])
        await mergeContent(set1, set2)
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Contradiction)
        expect((error as Contradiction).reason).toBe('Empty set intersection')
      }
    })
  })
})