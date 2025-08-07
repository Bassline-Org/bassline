import { describe, test, expect } from 'vitest'
import { grow, shrink, serializeTaggedCollection, deserializeTaggedCollection } from '../collections'
import { mergeContent } from '../merge'
import { structuralEquals } from '../equality'

describe('serialization across worker boundaries', () => {
  // Helper to simulate worker serialization (JSON.stringify/parse)
  function simulateWorkerSerialization<T>(data: T): T {
    return JSON.parse(JSON.stringify(data))
  }

  describe('basic serialization', () => {
    test('tagged collections survive JSON round-trip', () => {
      const collections = [
        grow.set([1, 2, 3]),
        shrink.set(['a', 'b', 'c']),
        grow.array([1, 2, 3]),
        shrink.array(['x', 'y', 'z']),
        grow.map([['key1', 'value1'], ['key2', 'value2']]),
        shrink.map([['a', 1], ['b', 2]])
      ]

      for (const collection of collections) {
        const serialized = serializeTaggedCollection(collection)
        const afterWorker = simulateWorkerSerialization(serialized)
        const deserialized = deserializeTaggedCollection(afterWorker)
        
        expect(structuralEquals(collection, deserialized)).toBe(true)
      }
    })

    test('nested tagged collections serialize correctly', () => {
      const nestedMap = grow.map([
        ['tags', grow.set(['react', 'typescript'])],
        ['counts', shrink.array([1, 2, 3, 4, 5])],
        ['metadata', grow.map([['version', 1]])]
      ])

      const serialized = serializeTaggedCollection(nestedMap)
      const afterWorker = simulateWorkerSerialization(serialized)
      const deserialized = deserializeTaggedCollection(afterWorker)

      expect(structuralEquals(nestedMap, deserialized)).toBe(true)
    })
  })

  describe('merge after deserialization', () => {
    test('deserialized GrowSets merge correctly', async () => {
      const set1 = grow.set([1, 2, 3])
      const set2 = grow.set([3, 4, 5])

      // Simulate sending over worker boundary
      const serialized1 = serializeTaggedCollection(set1)
      const serialized2 = serializeTaggedCollection(set2)
      
      const afterWorker1 = simulateWorkerSerialization(serialized1)
      const afterWorker2 = simulateWorkerSerialization(serialized2)
      
      const deserialized1 = deserializeTaggedCollection(afterWorker1)
      const deserialized2 = deserializeTaggedCollection(afterWorker2)

      // Merge the deserialized collections
      const merged = await mergeContent(deserialized1, deserialized2) as any
      
      expect(merged._tag).toBe('GrowSet')
      expect(merged.values).toEqual(new Set([1, 2, 3, 4, 5]))
    })

    test('deserialized ShrinkSets merge correctly', async () => {
      const set1 = shrink.set([1, 2, 3, 4])
      const set2 = shrink.set([3, 4, 5, 6])

      // Simulate worker boundary
      const serialized1 = serializeTaggedCollection(set1)
      const serialized2 = serializeTaggedCollection(set2)
      
      const deserialized1 = deserializeTaggedCollection(simulateWorkerSerialization(serialized1))
      const deserialized2 = deserializeTaggedCollection(simulateWorkerSerialization(serialized2))

      const merged = await mergeContent(deserialized1, deserialized2) as any
      
      expect(merged._tag).toBe('ShrinkSet')
      expect(merged.values).toEqual(new Set([3, 4]))
    })

    test('complex nested structure after worker round-trip', async () => {
      const config1 = grow.map([
        ['server', grow.map([
          ['port', 3000],
          ['allowedMethods', grow.set(['GET', 'POST'])]
        ])],
        ['features', shrink.set(['auth', 'logging', 'metrics', 'cache'])]
      ])

      const config2 = grow.map([
        ['server', grow.map([
          ['host', 'localhost'],
          ['allowedMethods', grow.set(['POST', 'PUT'])]
        ])],
        ['features', shrink.set(['auth', 'logging', 'security'])]
      ])

      // Serialize and send over worker boundary
      const s1 = deserializeTaggedCollection(simulateWorkerSerialization(serializeTaggedCollection(config1)))
      const s2 = deserializeTaggedCollection(simulateWorkerSerialization(serializeTaggedCollection(config2)))

      const merged = await mergeContent(s1, s2) as any
      
      expect(merged._tag).toBe('GrowMap')
      
      // Check server config merged correctly
      const serverConfig = merged.entries.get('server')
      expect(serverConfig._tag).toBe('GrowMap')
      expect(serverConfig.entries.get('port')).toBe(3000)
      expect(serverConfig.entries.get('host')).toBe('localhost')
      
      // Check allowed methods grew
      const allowedMethods = serverConfig.entries.get('allowedMethods')
      expect(allowedMethods._tag).toBe('GrowSet')
      expect(allowedMethods.values).toEqual(new Set(['GET', 'POST', 'PUT']))
      
      // Check features shrank to intersection
      const features = merged.entries.get('features')
      expect(features._tag).toBe('ShrinkSet')
      expect(features.values).toEqual(new Set(['auth', 'logging']))
    })
  })

  describe('primitives in tagged collections', () => {
    test('sets with various primitive types', () => {
      const mixedSet = grow.set([
        1, 'string', true, null, 
        { nested: 'object' },
        [1, 2, 3],
        new Date('2024-01-01')
      ])

      const serialized = serializeTaggedCollection(mixedSet)
      const afterWorker = simulateWorkerSerialization(serialized)
      const deserialized = deserializeTaggedCollection(afterWorker)

      // Note: Dates will be serialized as strings, so exact equality won't work
      // But the structure should be preserved
      expect(deserialized._tag).toBe('GrowSet')
      expect(deserialized.values.size).toBe(7)
      expect(deserialized.values.has(1)).toBe(true)
      expect(deserialized.values.has('string')).toBe(true)
      expect(deserialized.values.has(true)).toBe(true)
      expect(deserialized.values.has(null)).toBe(true)
    })

    test('maps with complex keys and values', () => {
      const complexMap = grow.map([
        ['simpleKey', 'simpleValue'],
        ['numberKey', 42],
        ['arrayKey', [1, 2, { nested: true }]],
        ['objectKey', { x: 1, y: 2 }],
        ['nestedCollection', grow.set(['a', 'b', 'c'])]
      ])

      const serialized = serializeTaggedCollection(complexMap)
      const afterWorker = simulateWorkerSerialization(serialized)
      const deserialized = deserializeTaggedCollection(afterWorker)

      expect(deserialized._tag).toBe('GrowMap')
      expect(deserialized.entries.get('simpleKey')).toBe('simpleValue')
      expect(deserialized.entries.get('numberKey')).toBe(42)
      
      const nestedCollection = deserialized.entries.get('nestedCollection')
      expect(nestedCollection._tag).toBe('GrowSet')
      expect(nestedCollection.values).toEqual(new Set(['a', 'b', 'c']))
    })
  })

  describe('performance characteristics', () => {
    test('large collections serialize efficiently', () => {
      const largeSet = grow.set(Array.from({ length: 1000 }, (_, i) => i))
      const largeArray = grow.array(Array.from({ length: 1000 }, (_, i) => `item-${i}`))
      
      const start = performance.now()
      
      const serializedSet = serializeTaggedCollection(largeSet)
      const serializedArray = serializeTaggedCollection(largeArray)
      
      const afterWorkerSet = simulateWorkerSerialization(serializedSet)
      const afterWorkerArray = simulateWorkerSerialization(serializedArray)
      
      const deserializedSet = deserializeTaggedCollection(afterWorkerSet)
      const deserializedArray = deserializeTaggedCollection(afterWorkerArray)
      
      const end = performance.now()
      
      // Should complete in reasonable time (less than 100ms for 2000 items)
      expect(end - start).toBeLessThan(100)
      
      expect(deserializedSet.values.size).toBe(1000)
      expect(deserializedArray.items.length).toBe(1000)
    })
  })
})