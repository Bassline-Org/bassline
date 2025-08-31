import { describe, it, expect } from 'vitest'
import { P } from '../combinators'
import { 
  SetInterfaceSchema, 
  SetInputHandlerSchema, 
  ConnectSchema,
  BatchSchema 
} from '../schemas'

describe('Zod Integration', () => {
  describe('zod combinator', () => {
    it('should validate and return typed data for valid setInterface command', () => {
      const validCommand = ['setInterface', {
        inputs: [
          { name: 'input1', connectionLimit: 1 },
          { name: 'input2', connectionLimit: 2 }
        ],
        outputs: [
          { name: 'output1', connectionLimit: 3 },
          { name: 'output2', connectionLimit: null }
        ]
      }]

      const result = P.zod(SetInterfaceSchema)(validCommand)
      
      expect(result[0]).toBe('setInterface')
      if (result[1] && result[1].inputs && result[1].inputs[0]) {
        expect(result[1].inputs).toHaveLength(2)
        expect(result[1].outputs).toHaveLength(2)
        expect(result[1].inputs[0].name).toBe('input1')
        expect(result[1].inputs[0].connectionLimit).toBe(1)
      }
      if (result[1] && result[1].outputs && result[1].outputs[1]) {
        expect(result[1].outputs[1].connectionLimit).toBe(null)
      }
    })

    it('should throw error for invalid setInterface command', () => {
      const invalidCommand = ['setInterface', {
        inputs: 'not an array', // should be array
        outputs: []
      }]

      expect(() => P.zod(SetInterfaceSchema)(invalidCommand)).toThrow()
    })

    it('should validate setInputHandler command', () => {
      const validCommand = ['set-input-handler', 'port1', ['handler1', () => {}]]
      
      const result = P.zod(SetInputHandlerSchema)(validCommand)
      
      expect(result[0]).toBe('set-input-handler')
      expect(result[1]).toBe('port1')
      expect(result[2]).toEqual(['handler1', expect.any(Function)])
    })

    it('should validate connect command', () => {
      const validCommand = ['connect', 'sourcePort', ['targetGadget', 'targetPort']]
      
      const result = P.zod(ConnectSchema)(validCommand)
      
      expect(result[0]).toBe('connect')
      expect(result[1]).toBe('sourcePort')
      expect(result[2]).toEqual(['targetGadget', 'targetPort'])
    })

    it('should validate batch command', () => {
      const validCommand = ['batch', [
        ['setInterface', { inputs: [], outputs: [] }],
        ['connect', 'port1', ['gadget2', 'port2']]
      ]]
      
      const result = P.zod(BatchSchema)(validCommand)
      
      expect(result[0]).toBe('batch')
      expect(result[1]).toHaveLength(2)
      expect(result[1][0][0]).toBe('setInterface')
      expect(result[1][1][0]).toBe('connect')
    })
  })

  describe('zodPredicate combinator', () => {
    it('should return true for valid commands', () => {
      const validSetInterface = ['setInterface', {
        inputs: [{ name: 'input1' }],
        outputs: [{ name: 'output1' }]
      }]
      
      const validConnect = ['connect', 'port1', ['gadget2', 'port2']]
      
      expect(P.zodPredicate(SetInterfaceSchema)(validSetInterface)).toBe(true)
      expect(P.zodPredicate(ConnectSchema)(validConnect)).toBe(true)
    })

    it('should return false for invalid commands', () => {
      const invalidSetInterface = ['setInterface', {
        inputs: 'not an array',
        outputs: []
      }]
      
      const invalidConnect = ['connect', 'port1', 'not a path']
      
      expect(P.zodPredicate(SetInterfaceSchema)(invalidSetInterface)).toBe(false)
      expect(P.zodPredicate(ConnectSchema)(invalidConnect)).toBe(false)
    })

    it('should work with different command types', () => {
      const commands = [
        ['setInterface', { inputs: [], outputs: [] }],
        ['set-input-handler', 'port1', ['handler1', () => {}]],
        ['connect', 'port1', ['gadget2', 'port2']],
        ['batch', []]
      ]
      
      const predicates = [
        P.zodPredicate(SetInterfaceSchema),
        P.zodPredicate(SetInputHandlerSchema),
        P.zodPredicate(ConnectSchema),
        P.zodPredicate(BatchSchema)
      ]
      
      commands.forEach((command, index) => {
        const predicate = predicates[index]
        if (predicate) {
          expect(predicate(command)).toBe(true)
        }
      })
    })
  })
})
