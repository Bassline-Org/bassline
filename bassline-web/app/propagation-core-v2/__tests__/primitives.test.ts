import { describe, it, expect } from 'vitest'
import { 
  getPrimitiveGadget, 
  getGadgetsByCategory,
  mathGadgets,
  stringGadgets,
  logicGadgets,
  controlGadgets,
  arrayGadgets
} from '../primitives'

describe('Primitive Gadgets', () => {
  describe('Math Gadgets', () => {
    it('should add two numbers', async () => {
      const add = getPrimitiveGadget('add')!
      expect(add).toBeDefined()
      
      const inputs = new Map([['a', 5], ['b', 3]])
      expect(add.activation(inputs)).toBe(true)
      
      const result = await add.body(inputs)
      expect(result.get('sum')).toBe(8)
    })
    
    it('should multiply numbers', async () => {
      const multiply = getPrimitiveGadget('multiply')!
      const inputs = new Map([['a', 4], ['b', 7]])
      
      const result = await multiply.body(inputs)
      expect(result.get('product')).toBe(28)
    })
    
    it('should handle division by zero check', async () => {
      const divide = getPrimitiveGadget('divide')!
      
      // Should not activate with zero divisor
      const inputs = new Map([['a', 10], ['b', 0]])
      expect(divide.activation(inputs)).toBe(false)
      
      // Should work with non-zero divisor
      inputs.set('b', 2)
      expect(divide.activation(inputs)).toBe(true)
      const result = await divide.body(inputs)
      expect(result.get('quotient')).toBe(5)
    })
    
    it('should calculate square root', async () => {
      const sqrt = getPrimitiveGadget('sqrt')!
      
      // Should not activate for negative numbers
      const negativeInputs = new Map([['value', -4]])
      expect(sqrt.activation(negativeInputs)).toBe(false)
      
      // Should work for positive numbers
      const inputs = new Map([['value', 16]])
      expect(sqrt.activation(inputs)).toBe(true)
      const result = await sqrt.body(inputs)
      expect(result.get('result')).toBe(4)
    })
  })
  
  describe('String Gadgets', () => {
    it('should concatenate strings', async () => {
      const concat = getPrimitiveGadget('concat')!
      const inputs = new Map([['a', 'Hello '], ['b', 'World']])
      
      const result = await concat.body(inputs)
      expect(result.get('result')).toBe('Hello World')
    })
    
    it('should get string length', async () => {
      const length = getPrimitiveGadget('length')!
      const inputs = new Map([['value', 'Hello']])
      
      const result = await length.body(inputs)
      expect(result.get('length')).toBe(5)
    })
    
    it('should split strings', async () => {
      const split = getPrimitiveGadget('split')!
      const inputs = new Map([['string', 'a,b,c'], ['separator', ',']])
      
      const result = await split.body(inputs)
      expect(result.get('result')).toEqual(['a', 'b', 'c'])
    })
    
    it('should join arrays', async () => {
      const join = getPrimitiveGadget('join')!
      const inputs = new Map<string, unknown>([['array', ['a', 'b', 'c']], ['separator', '-']])
      
      expect(join.activation(inputs)).toBe(true)
      const result = await join.body(inputs)
      expect(result.get('result')).toBe('a-b-c')
    })
  })
  
  describe('Logic Gadgets', () => {
    it('should perform AND operation', async () => {
      const and = getPrimitiveGadget('and')!
      
      const inputs1 = new Map([['a', true], ['b', true]])
      expect((await and.body(inputs1)).get('result')).toBe(true)
      
      const inputs2 = new Map([['a', true], ['b', false]])
      expect((await and.body(inputs2)).get('result')).toBe(false)
    })
    
    it('should perform XOR operation', async () => {
      const xor = getPrimitiveGadget('xor')!
      
      const inputs1 = new Map<string, unknown>([['a', true], ['b', false]])
      expect((await xor.body(inputs1)).get('result')).toBe(true)
      
      const inputs2 = new Map<string, unknown>([['a', true], ['b', true]])
      expect((await xor.body(inputs2)).get('result')).toBe(false)
      
      const inputs3 = new Map<string, unknown>([['a', false], ['b', false]])
      expect((await xor.body(inputs3)).get('result')).toBe(false)
    })
    
    it('should compare numbers', async () => {
      const greaterThan = getPrimitiveGadget('greaterThan')!
      
      const inputs1 = new Map([['a', 5], ['b', 3]])
      expect((await greaterThan.body(inputs1)).get('result')).toBe(true)
      
      const inputs2 = new Map([['a', 2], ['b', 7]])
      expect((await greaterThan.body(inputs2)).get('result')).toBe(false)
    })
    
    it('should test equality', async () => {
      const equals = getPrimitiveGadget('equals')!
      
      const inputs1 = new Map([['a', 'test'], ['b', 'test']])
      expect((await equals.body(inputs1)).get('result')).toBe(true)
      
      const inputs2 = new Map([['a', 5], ['b', '5']])
      expect((await equals.body(inputs2)).get('result')).toBe(false)
    })
  })
  
  describe('Control Gadgets', () => {
    it('should gate values', async () => {
      const gate = getPrimitiveGadget('gate')!
      
      // Gate open
      const inputs1 = new Map<string, unknown>([['value', 42], ['condition', true]])
      const result1 = await gate.body(inputs1)
      expect(result1.get('output')).toBe(42)
      
      // Gate closed
      const inputs2 = new Map<string, unknown>([['value', 42], ['condition', false]])
      const result2 = await gate.body(inputs2)
      expect(result2.has('output')).toBe(false)
    })
    
    it('should switch between values', async () => {
      const switchGadget = getPrimitiveGadget('switch')!
      
      const inputs1 = new Map<string, unknown>([['condition', true], ['true', 'yes'], ['false', 'no']])
      expect((await switchGadget.body(inputs1)).get('result')).toBe('yes')
      
      const inputs2 = new Map<string, unknown>([['condition', false], ['true', 'yes'], ['false', 'no']])
      expect((await switchGadget.body(inputs2)).get('result')).toBe('no')
    })
    
    it('should demultiplex values', async () => {
      const demux = getPrimitiveGadget('demux')!
      
      // Route to out0
      const inputs1 = new Map<string, unknown>([['value', 'data'], ['selector', false]])
      const result1 = await demux.body(inputs1)
      expect(result1.get('out0')).toBe('data')
      expect(result1.has('out1')).toBe(false)
      
      // Route to out1
      const inputs2 = new Map<string, unknown>([['value', 'data'], ['selector', true]])
      const result2 = await demux.body(inputs2)
      expect(result2.has('out0')).toBe(false)
      expect(result2.get('out1')).toBe('data')
    })
  })
  
  describe('Array Gadgets', () => {
    it('should get first element', async () => {
      const first = getPrimitiveGadget('first')!
      const inputs = new Map<string, unknown>([['array', [1, 2, 3]]])
      
      const result = await first.body(inputs)
      expect(result.get('result')).toBe(1)
    })
    
    it('should get nth element', async () => {
      const nth = getPrimitiveGadget('nth')!
      const inputs = new Map<string, unknown>([['array', ['a', 'b', 'c', 'd']], ['index', 2]])
      
      const result = await nth.body(inputs)
      expect(result.get('result')).toBe('c')
    })
    
    it('should append to array', async () => {
      const append = getPrimitiveGadget('append')!
      const inputs = new Map<string, unknown>([['array', [1, 2]], ['value', 3]])
      
      const result = await append.body(inputs)
      expect(result.get('result')).toEqual([1, 2, 3])
    })
    
    it('should reverse array', async () => {
      const reverse = getPrimitiveGadget('reverse')!
      const inputs = new Map<string, unknown>([['array', [1, 2, 3, 4]]])
      
      const result = await reverse.body(inputs)
      expect(result.get('result')).toEqual([4, 3, 2, 1])
    })
    
    it('should filter empty values', async () => {
      const filterEmpty = getPrimitiveGadget('filterEmpty')!
      const inputs = new Map<string, unknown>([['array', [1, null, '', 2, undefined, 3]]])
      
      const result = await filterEmpty.body(inputs)
      expect(result.get('result')).toEqual([1, 2, 3])
    })
  })
  
  describe('Helper Functions', () => {
    it('should get gadgets by category', () => {
      const mathGadgetList = getGadgetsByCategory('math')
      expect(mathGadgetList.length).toBeGreaterThan(0)
      expect(mathGadgetList.every(g => g.category === 'math')).toBe(true)
      
      const logicGadgetList = getGadgetsByCategory('logic')
      expect(logicGadgetList.length).toBeGreaterThan(0)
      expect(logicGadgetList.every(g => g.category === 'logic')).toBe(true)
    })
    
    it('should have unique IDs for all gadgets', () => {
      const allGadgets = [
        ...mathGadgets,
        ...stringGadgets,
        ...logicGadgets,
        ...controlGadgets,
        ...arrayGadgets
      ]
      
      const ids = allGadgets.map(g => g.id)
      const uniqueIds = new Set(ids)
      expect(ids.length).toBe(uniqueIds.size)
    })
  })
})