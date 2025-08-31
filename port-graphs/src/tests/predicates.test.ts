import { describe, it, expect } from 'vitest'
import { P } from '../combinators'

describe('Predicates', () => {
  describe('Type Predicates', () => {
    it('should work with isString', () => {
      expect(P.isString('hello')).toBe(true)
      expect(P.isString(42)).toBe(false)
      expect(P.isString(true)).toBe(false)
      expect(P.isString({})).toBe(false)
    })

    it('should work with isNumber', () => {
      expect(P.isNumber(42)).toBe(true)
      expect(P.isNumber(3.14)).toBe(true)
      expect(P.isNumber('42')).toBe(false)
      expect(P.isNumber(true)).toBe(false)
    })

    it('should work with isBoolean', () => {
      expect(P.isBoolean(true)).toBe(true)
      expect(P.isBoolean(false)).toBe(true)
      expect(P.isBoolean(1)).toBe(false)
      expect(P.isBoolean('true')).toBe(false)
    })

    it('should work with isArray', () => {
      expect(P.isArray([])).toBe(true)
      expect(P.isArray([1, 2, 3])).toBe(true)
      expect(P.isArray({})).toBe(false)
      expect(P.isArray('array')).toBe(false)
    })

    it('should work with isObject', () => {
      expect(P.isObject({})).toBe(true)
      expect(P.isObject({ key: 'value' })).toBe(true)
      expect(P.isObject([])).toBe(false)
      expect(P.isObject('object')).toBe(false)
    })

    it('should work with isNull', () => {
      expect(P.isNull(null)).toBe(true)
      expect(P.isNull(0)).toBe(false)
      expect(P.isNull('')).toBe(false)
    })
  })

  describe('Structural Predicates', () => {
    it('should work with hasLength', () => {
      expect(P.hasLength(3)([1, 2, 3])).toBe(true)
      expect(P.hasLength(0)([])).toBe(true)
      expect(P.hasLength(2)([1, 2, 3])).toBe(false)
      expect(P.hasLength(1)('hello')).toBe(false) // not an array
    })

    it('should work with hasMinLength', () => {
      expect(P.hasMinLength(2)([1, 2, 3])).toBe(true)
      expect(P.hasMinLength(3)([1, 2, 3])).toBe(true)
      expect(P.hasMinLength(4)([1, 2, 3])).toBe(false)
    })

    it('should work with startsWith', () => {
      const startsWithOne = P.startsWith(P.eq(1))
      expect(startsWithOne([1, 2, 3])).toBe(true)
      expect(startsWithOne([2, 1, 3])).toBe(false)
      expect(startsWithOne([])).toBe(false)
    })

    it('should work with sequence', () => {
      const hasNumberSequence = P.sequence(P.isNumber, P.isString, P.isBoolean)
      expect(hasNumberSequence([1, 'hello', true])).toBe(true)
      expect(hasNumberSequence([1, 2, true])).toBe(false)
      expect(hasNumberSequence([1, 'hello'])).toBe(false)
    })

    it('should work with hasStructure', () => {
      const hasStructure = P.hasStructure([P.isNumber, P.isString, P.isBoolean])
      expect(hasStructure([1, 'hello', true])).toBe(true)
      expect(hasStructure([1, 2, true])).toBe(false)
      expect(hasStructure([1, 'hello'])).toBe(false)
    })
  })

  describe('Object Predicates', () => {
    it('should work with hasKeys', () => {
      const hasNameAndAge = P.hasKeys('name', 'age')
      expect(hasNameAndAge({ name: 'John', age: 30 })).toBe(true)
      expect(hasNameAndAge({ name: 'John' })).toBe(false)
      expect(hasNameAndAge({})).toBe(false)
    })

    it('should work with hasKeyValue', () => {
      const hasNameJohn = P.hasKeyValue('name', 'John')
      expect(hasNameJohn({ name: 'John', age: 30 })).toBe(true)
      expect(hasNameJohn({ name: 'Jane', age: 30 })).toBe(false)
      expect(hasNameJohn({ age: 30 })).toBe(false)
    })

    it('should work with objectStructure', () => {
      const hasNameStringAndAgeNumber = P.objectStructure([
        { key: 'name', predicate: P.isString },
        { key: 'age', predicate: P.isNumber }
      ])
      
      expect(hasNameStringAndAgeNumber({ name: 'John', age: 30 })).toBe(true)
      expect(hasNameStringAndAgeNumber({ name: 'John', age: '30' })).toBe(false)
      expect(hasNameStringAndAgeNumber({ name: 123, age: 30 })).toBe(false)
    })

    it('should work with hasMinKeys', () => {
      const hasAtLeastTwoKeys = P.hasMinKeys(2)
      expect(hasAtLeastTwoKeys({ a: 1, b: 2 })).toBe(true)
      expect(hasAtLeastTwoKeys({ a: 1, b: 2, c: 3 })).toBe(true)
      expect(hasAtLeastTwoKeys({ a: 1 })).toBe(false)
    })

    it('should work with hasExactKeys', () => {
      const hasExactlyTwoKeys = P.hasExactKeys(2)
      expect(hasExactlyTwoKeys({ a: 1, b: 2 })).toBe(true)
      expect(hasExactlyTwoKeys({ a: 1 })).toBe(false)
      expect(hasExactlyTwoKeys({ a: 1, b: 2, c: 3 })).toBe(false)
    })
  })

  describe('Comparison Predicates', () => {
    it('should work with eq', () => {
      const is42 = P.eq(42)
      expect(is42(42)).toBe(true)
      expect(is42(41)).toBe(false)
      expect(is42('42')).toBe(false)
    })

    it('should work with ne', () => {
      const isNot42 = P.ne(42)
      expect(isNot42(41)).toBe(true)
      expect(isNot42('42')).toBe(true)
      expect(isNot42(42)).toBe(false)
    })

    it('should work with gt', () => {
      const isGreaterThan5 = P.gt(5)
      expect(isGreaterThan5(10)).toBe(true)
      expect(isGreaterThan5(5)).toBe(false)
      expect(isGreaterThan5(3)).toBe(false)
    })

    it('should work with lt', () => {
      const isLessThan5 = P.lt(5)
      expect(isLessThan5(3)).toBe(true)
      expect(isLessThan5(5)).toBe(false)
      expect(isLessThan5(10)).toBe(false)
    })

    it('should work with inRange', () => {
      const isInRange1To10 = P.inRange(1, 10)
      expect(isInRange1To10(5)).toBe(true)
      expect(isInRange1To10(1)).toBe(true)
      expect(isInRange1To10(10)).toBe(true)
      expect(isInRange1To10(0)).toBe(false)
      expect(isInRange1To10(11)).toBe(false)
    })
  })
})
