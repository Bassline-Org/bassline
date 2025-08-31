import { describe, it, expect } from 'vitest'
import { Term, Nothing, Contradiction } from '../terms'

describe('Terms', () => {
  describe('Term type', () => {
    it('should accept string values', () => {
      const stringTerm: Term = 'hello'
      expect(typeof stringTerm).toBe('string')
      expect(stringTerm).toBe('hello')
    })

    it('should accept number values', () => {
      const numberTerm: Term = 42
      expect(typeof numberTerm).toBe('number')
      expect(numberTerm).toBe(42)
    })

    it('should accept boolean values', () => {
      const booleanTerm: Term = true
      expect(typeof booleanTerm).toBe('boolean')
      expect(booleanTerm).toBe(true)
    })

    it('should accept symbol values', () => {
      const symbolTerm: Term = Symbol('test')
      expect(typeof symbolTerm).toBe('symbol')
    })

    it('should accept null values', () => {
      const nullTerm: Term = null
      expect(nullTerm).toBe(null)
    })

    it('should accept array values', () => {
      const arrayTerm: Term = [1, 'hello', true]
      expect(Array.isArray(arrayTerm)).toBe(true)
      expect(arrayTerm).toHaveLength(3)
    })

    it('should accept object values', () => {
      const objectTerm: Term = { key: 'value', number: 42 }
      expect(typeof objectTerm).toBe('object')
      expect(objectTerm['key']).toBe('value')
      expect(objectTerm['number']).toBe(42)
    })

    it('should accept function values', () => {
      const functionTerm: Term = () => 'hello'
      expect(typeof functionTerm).toBe('function')
      expect(functionTerm()).toBe('hello')
    })

    it('should accept nested structures', () => {
      const nestedTerm: Term = {
        array: [1, 2, { nested: 'value' }],
        function: () => 42,
        nullValue: null
      }
      
      const array = nestedTerm['array']
      if (Array.isArray(array) && array.length > 2) {
        expect(array).toHaveLength(3)
        const nestedObj = array[2] as { nested: string }
        expect(nestedObj.nested).toBe('value')
      }
      expect(typeof nestedTerm['function']).toBe('function')
      expect(nestedTerm['nullValue']).toBe(null)
    })
  })

  describe('Symbols', () => {
    it('should have Nothing symbol', () => {
      expect(typeof Nothing).toBe('symbol')
      expect(Nothing.description).toBe('Nothing')
    })

    it('should have Contradiction symbol', () => {
      expect(typeof Contradiction).toBe('symbol')
      expect(Contradiction.description).toBe('Contradiction')
    })

    it('should have unique symbols', () => {
      expect(Nothing).not.toBe(Contradiction)
    })

    it('should work in Term contexts', () => {
      const termWithNothing: Term = Nothing
      const termWithContradiction: Term = Contradiction
      
      expect(termWithNothing).toBe(Nothing)
      expect(termWithContradiction).toBe(Contradiction)
    })
  })

  describe('Term arrays', () => {
    it('should accept arrays of mixed types', () => {
      const mixedArray: Term[] = [
        'string',
        42,
        true,
        null,
        Symbol('test'),
        [1, 2, 3],
        { key: 'value' },
        () => 'function'
      ]
      
      expect(mixedArray).toHaveLength(8)
      expect(typeof mixedArray[0]).toBe('string')
      expect(typeof mixedArray[1]).toBe('number')
      expect(typeof mixedArray[2]).toBe('boolean')
      expect(mixedArray[3]).toBe(null)
      expect(typeof mixedArray[4]).toBe('symbol')
      expect(Array.isArray(mixedArray[5])).toBe(true)
      expect(typeof mixedArray[6]).toBe('object')
      expect(typeof mixedArray[7]).toBe('function')
    })

    it('should accept nested arrays', () => {
      const nestedArray: Term[] = [
        [1, 2, 3],
        ['a', 'b', 'c'],
        [{ nested: 'object' }]
      ]
      
      expect(nestedArray).toHaveLength(3)
      expect(Array.isArray(nestedArray[0])).toBe(true)
      expect(Array.isArray(nestedArray[1])).toBe(true)
      expect(Array.isArray(nestedArray[2])).toBe(true)
    })
  })

  describe('Term objects', () => {
    it('should accept objects with mixed value types', () => {
      const mixedObject: { [key: string]: Term } = {
        string: 'hello',
        number: 42,
        boolean: true,
        null: null,
        symbol: Symbol('test'),
        array: [1, 2, 3],
        object: { nested: 'value' },
        function: () => 'result'
      }
      
      expect(typeof mixedObject['string']).toBe('string')
      expect(typeof mixedObject['number']).toBe('number')
      expect(typeof mixedObject['boolean']).toBe('boolean')
      expect(mixedObject['null']).toBe(null)
      expect(typeof mixedObject['symbol']).toBe('symbol')
      expect(Array.isArray(mixedObject['array'])).toBe(true)
      expect(typeof mixedObject['object']).toBe('object')
      expect(typeof mixedObject['function']).toBe('function')
    })
  })
})
