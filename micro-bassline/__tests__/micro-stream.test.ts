/**
 * Tests for stream implementation
 */

import { describe, it, expect, vi } from 'vitest'
import { stream, merge, guards } from '../src/micro-stream'

describe('stream', () => {
  describe('Basic Operations', () => {
    it('should write and subscribe to values', () => {
      const s = stream<number>()
      const handler = vi.fn()
      
      s.subscribe(handler)
      s.write(42)
      
      expect(handler).toHaveBeenCalledWith(42)
    })
    
    it('should pipe to another stream', () => {
      const source = stream<number>()
      const target = stream<number>()
      const handler = vi.fn()
      
      source.pipe(target)
      target.subscribe(handler)
      
      source.write(10)
      expect(handler).toHaveBeenCalledWith(10)
    })
    
    it('should pipe to a function', () => {
      const s = stream<string>()
      const handler = vi.fn()
      
      s.pipe(handler)
      s.write('hello')
      
      expect(handler).toHaveBeenCalledWith('hello')
    })
  })
  
  describe('Filtering', () => {
    it('should filter values', () => {
      const s = stream<number>()
      const filtered = s.filter(x => x > 5)
      const handler = vi.fn()
      
      filtered.subscribe(handler)
      
      s.write(3)
      s.write(10)
      s.write(2)
      s.write(8)
      
      expect(handler).toHaveBeenCalledTimes(2)
      expect(handler).toHaveBeenCalledWith(10)
      expect(handler).toHaveBeenCalledWith(8)
    })
    
    it('should support chained filters', () => {
      const s = stream<number>()
      const handler = vi.fn()
      
      const filtered = s
        .filter(x => x > 0)
        .filter(x => x < 10)
      
      filtered.subscribe(handler)
      
      s.write(-5)
      s.write(5)
      s.write(15)
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(5)
    })
  })
  
  describe('Transformation', () => {
    it('should transform values', () => {
      const s = stream<number>()
      const doubled = s.transform(x => x * 2)
      const handler = vi.fn()
      
      doubled.subscribe(handler)
      
      s.write(5)
      s.write(10)
      
      expect(handler).toHaveBeenCalledWith(10)
      expect(handler).toHaveBeenCalledWith(20)
    })
    
    it('should stop propagation on null/undefined', () => {
      const s = stream<number>()
      const transformed = s.transform(x => x > 5 ? x : null)
      const handler = vi.fn()
      
      transformed.subscribe(handler)
      
      s.write(3)
      s.write(10)
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(10)
    })
  })
  
  describe('Tee and Merge', () => {
    it('should tee into two streams', () => {
      const s = stream<string>()
      const [a, b] = s.tee()
      
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      
      a.subscribe(handlerA)
      b.subscribe(handlerB)
      
      s.write('test')
      
      expect(handlerA).toHaveBeenCalledWith('test')
      expect(handlerB).toHaveBeenCalledWith('test')
    })
    
    it('should merge multiple streams', () => {
      const a = stream<number>()
      const b = stream<number>()
      const c = stream<number>()
      
      const merged = merge(a, b, c)
      const handler = vi.fn()
      
      merged.subscribe(handler)
      
      a.write(1)
      b.write(2)
      c.write(3)
      
      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenCalledWith(1)
      expect(handler).toHaveBeenCalledWith(2)
      expect(handler).toHaveBeenCalledWith(3)
    })
  })
  
  describe('guards', () => {
    it('should check for required inputs', () => {
      const guard = guards.hasInputs('a', 'b')
      
      expect(guard({a: 1, b: 2})).toBe(true)
      expect(guard({a: 1})).toBe(false)
      expect(guard({a: null, b: 2})).toBe(false)
      expect(guard(null)).toBe(false)
    })
    
    it('should check types', () => {
      const guard = guards.hasTypes({
        a: 'number',
        b: 'string'
      })
      
      expect(guard({a: 1, b: 'hello'})).toBe(true)
      expect(guard({a: '1', b: 'hello'})).toBe(false)
      expect(guard({a: 1, b: 2})).toBe(false)
    })
    
    it('should check finite numbers', () => {
      const guard = guards.isFinite('x', 'y')
      
      expect(guard({x: 1, y: 2})).toBe(true)
      expect(guard({x: Infinity, y: 2})).toBe(false)
      expect(guard({x: NaN, y: 2})).toBe(false)
    })
    
    it('should combine guards', () => {
      const guard = guards.all(
        guards.hasInputs('a', 'b'),
        guards.hasTypes({a: 'number', b: 'number'}),
        guards.isFinite('a', 'b')
      )
      
      expect(guard({a: 1, b: 2})).toBe(true)
      expect(guard({a: 1})).toBe(false)
      expect(guard({a: '1', b: 2})).toBe(false)
      expect(guard({a: Infinity, b: 2})).toBe(false)
    })
  })
  
  describe('Pipeline Example', () => {
    it('should work as a complete pipeline', () => {
      // Simulating an add gadget
      const inputStream = stream<any>()
      const handler = vi.fn()
      
      inputStream
        .filter(guards.hasInputs('a', 'b'))
        .filter(guards.hasTypes({a: 'number', b: 'number'}))
        .transform(({a, b}) => ({sum: a + b}))
        .subscribe(handler)
      
      inputStream.write({a: 1})           // Filtered: missing b
      inputStream.write({a: 1, b: '2'})   // Filtered: wrong type
      inputStream.write({a: 5, b: 3})     // Passes!
      
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith({sum: 8})
    })
  })
})