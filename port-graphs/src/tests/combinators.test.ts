import { describe, it, expect } from 'vitest'
import { P } from '../combinators'

describe('Combinators', () => {
  describe('Logical Combinators', () => {
    it('should work with or combinator', () => {
      const isNumberOrString = P.or(P.isNumber, P.isString)
      
      expect(isNumberOrString(42)).toBe(true)
      expect(isNumberOrString('hello')).toBe(true)
      expect(isNumberOrString(true)).toBe(false)
      expect(isNumberOrString({})).toBe(false)
    })

    it('should work with and combinator', () => {
      const isPositiveNumber = P.and(P.isNumber, (n: any) => n > 0)
      
      expect(isPositiveNumber(42)).toBe(true)
      expect(isPositiveNumber(-5)).toBe(false)
      expect(isPositiveNumber('hello')).toBe(false)
    })

    it('should work with not combinator', () => {
      const isNotString = P.not(P.isString)
      
      expect(isNotString(42)).toBe(true)
      expect(isNotString(true)).toBe(true)
      expect(isNotString('hello')).toBe(false)
    })

    it('should work with nor combinator', () => {
      const isNeitherStringNorNumber = P.nor(P.isString, P.isNumber)
      
      expect(isNeitherStringNorNumber(true)).toBe(true)
      expect(isNeitherStringNorNumber({})).toBe(true)
      expect(isNeitherStringNorNumber('hello')).toBe(false)
      expect(isNeitherStringNorNumber(42)).toBe(false)
    })
  })

  describe('Transformation Combinators', () => {
    it('should work with pipe combinator', () => {
      const double = (n: any) => n * 2
      const addOne = (n: any) => n + 1
      const transform = P.pipe(double, addOne)
      
      expect(transform(5)).toBe(11) // (5 * 2) + 1 = 11
    })

    it('should work with when combinator', () => {
      const doubleIfNumber = P.when(P.isNumber, (n: any) => n * 2)
      
      expect(doubleIfNumber(5)).toBe(10)
      expect(doubleIfNumber('hello')).toBe('hello') // unchanged when predicate fails
    })
  })

  describe('Composition Helpers', () => {
    it('should work with compose', () => {
      const double = (n: any) => n * 2
      const addOne = (n: any) => n + 1
      const transform = P.compose(double, addOne)
      
      expect(transform(5)).toBe(12) // (5 + 1) * 2 = 12 (right-to-left)
    })

    it('should work with composeMany', () => {
      const double = (n: any) => n * 2
      const addOne = (n: any) => n + 1
      const square = (n: any) => n * n
      const transform = P.composeMany(double, addOne, square)
      
      // Right-to-left composition: double(addOne(square(3)))
      // square(3) = 9, addOne(9) = 10, double(10) = 20
      expect(transform(3)).toBe(20)
    })
  })

  describe('Utility Combinators', () => {
    it('should work with id', () => {
      const value = { test: 'data' }
      expect(P.id(value)).toBe(value)
    })

    it('should work with constant', () => {
      const always42 = P.constant(42)
      expect(always42('anything')).toBe(42)
      expect(always42({})).toBe(42)
      expect(always42(null)).toBe(42)
    })
  })
})
