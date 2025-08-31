import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  SetInterfaceSchema,
  SetInputHandlerSchema,
  SetConnectionLimitSchema,
  ConnectSchema,
  ConnectAndSyncSchema,
  BatchSchema,
  CommandSchema,
  type GadgetInterface,
  type PortDefinition
} from '../schemas'

describe('Schemas', () => {
  describe('PortDefinition', () => {
    it('should validate basic port definition', () => {
      const validPort: PortDefinition = {
        name: 'testPort',
        value: 42,
        attributes: { type: 'number' },
        connectionLimit: 5
      }

      expect(() => z.object({
        name: z.string(),
        value: z.any().optional(),
        attributes: z.record(z.string(), z.any()).optional(),
        connectionLimit: z.union([z.number(), z.null()]).optional()
      }).parse(validPort)).not.toThrow()
    })

    it('should validate port with null connection limit', () => {
      const unlimitedPort: PortDefinition = {
        name: 'unlimitedPort',
        attributes: {},
        connectionLimit: null
      }

      expect(() => z.object({
        name: z.string(),
        value: z.any().optional(),
        attributes: z.record(z.string(), z.any()).optional(),
        connectionLimit: z.union([z.number(), z.null()]).optional()
      }).parse(unlimitedPort)).not.toThrow()
    })
  })

  describe('GadgetInterface', () => {
    it('should validate complete gadget interface', () => {
      const validInterface: GadgetInterface = {
        inputs: [
          { name: 'input1', value: 0, attributes: {}, connectionLimit: 1 },
          { name: 'input2', attributes: {}, connectionLimit: 2 }
        ],
        outputs: [
          { name: 'output1', attributes: {}, connectionLimit: 3 },
          { name: 'output2', attributes: {}, connectionLimit: null }
        ]
      }

      expect(() => z.object({
        inputs: z.array(z.object({
          name: z.string(),
          value: z.any().optional(),
          attributes: z.record(z.string(), z.any()).optional(),
          connectionLimit: z.union([z.number(), z.null()]).optional()
        })),
        outputs: z.array(z.object({
          name: z.string(),
          value: z.any().optional(),
          attributes: z.record(z.string(), z.any()).optional(),
          connectionLimit: z.union([z.number(), z.null()]).optional()
        }))
      }).parse(validInterface)).not.toThrow()
    })
  })

  describe('SetInterfaceSchema', () => {
    it('should validate setInterface command', () => {
      const validCommand = ['setInterface', {
        inputs: [{ name: 'input1' }],
        outputs: [{ name: 'output1' }]
      }]

      expect(() => SetInterfaceSchema.parse(validCommand)).not.toThrow()
    })

    it('should reject invalid setInterface command', () => {
      const invalidCommand = ['setInterface', {
        inputs: 'not an array',
        outputs: []
      }]

      expect(() => SetInterfaceSchema.parse(invalidCommand)).toThrow()
    })

    it('should reject command with wrong first element', () => {
      const invalidCommand = ['wrongCommand', {
        inputs: [],
        outputs: []
      }]

      expect(() => SetInterfaceSchema.parse(invalidCommand)).toThrow()
    })
  })

  describe('SetInputHandlerSchema', () => {
    it('should validate setInputHandler command', () => {
      const validCommand = ['set-input-handler', 'port1', ['handler1', () => {}]]

      expect(() => SetInputHandlerSchema.parse(validCommand)).not.toThrow()
    })

    it('should reject command with wrong number of arguments', () => {
      const invalidCommand = ['set-input-handler', 'port1']

      expect(() => SetInputHandlerSchema.parse(invalidCommand)).toThrow()
    })
  })

  describe('SetConnectionLimitSchema', () => {
    it('should validate setConnectionLimit command with number', () => {
      const validCommand = ['set-connection-limit', 'port1', 5]

      expect(() => SetConnectionLimitSchema.parse(validCommand)).not.toThrow()
    })

    it('should validate setConnectionLimit command with null', () => {
      const validCommand = ['set-connection-limit', 'port1', null]

      expect(() => SetConnectionLimitSchema.parse(validCommand)).not.toThrow()
    })

    it('should reject command with invalid limit type', () => {
      const invalidCommand = ['set-connection-limit', 'port1', 'invalid']

      expect(() => SetConnectionLimitSchema.parse(invalidCommand)).toThrow()
    })
  })

  describe('ConnectSchema', () => {
    it('should validate connect command', () => {
      const validCommand = ['connect', 'sourcePort', ['targetGadget', 'targetPort']]

      expect(() => ConnectSchema.parse(validCommand)).not.toThrow()
    })

    it('should reject command with invalid connection path', () => {
      const invalidCommand = ['connect', 'sourcePort', 'not a path']

      expect(() => ConnectSchema.parse(invalidCommand)).toThrow()
    })
  })

  describe('ConnectAndSyncSchema', () => {
    it('should validate connectAndSync command', () => {
      const validCommand = ['connect-and-sync', 'sourcePort', ['targetGadget', 'targetPort']]

      expect(() => ConnectAndSyncSchema.parse(validCommand)).not.toThrow()
    })
  })

  describe('BatchSchema', () => {
    it('should validate batch command', () => {
      const validCommand = ['batch', [
        ['setInterface', { inputs: [], outputs: [] }],
        ['connect', 'port1', ['gadget2', 'port2']]
      ]]

      expect(() => BatchSchema.parse(validCommand)).not.toThrow()
    })

    it('should validate empty batch', () => {
      const validCommand = ['batch', []]

      expect(() => BatchSchema.parse(validCommand)).not.toThrow()
    })
  })

  describe('CommandSchema', () => {
    it('should validate all command types', () => {
      const commands = [
        ['setInterface', { inputs: [], outputs: [] }],
        ['set-input-handler', 'port1', ['handler1', () => {}]],
        ['set-connection-limit', 'port1', 5],
        ['connect', 'port1', ['gadget2', 'port2']],
        ['connect-and-sync', 'port1', ['gadget2', 'port2']],
        ['batch', []]
      ]

      commands.forEach(command => {
        expect(() => CommandSchema.parse(command)).not.toThrow()
      })
    })

    it('should reject invalid commands', () => {
      const invalidCommands = [
        ['invalidCommand'],
        ['setInterface', 'not an object'],
        ['connect', 'port1', 'invalid path']
      ]

      invalidCommands.forEach(command => {
        expect(() => CommandSchema.parse(command)).toThrow()
      })
    })
  })

  describe('Type Inference', () => {
    it('should provide correct types for parsed commands', () => {
      const setInterfaceCommand = ['setInterface', {
        inputs: [{ name: 'input1', attributes: {}, connectionLimit: 1 }],
        outputs: [{ name: 'output1', attributes: {}, connectionLimit: 3 }]
      }] as const

      const parsed = SetInterfaceSchema.parse(setInterfaceCommand)
      
      // TypeScript should know the exact structure
      expect(parsed[0]).toBe('setInterface')
      if (parsed[1] && parsed[1].inputs && parsed[1].inputs[0]) {
        expect(parsed[1].inputs[0].name).toBe('input1')
        expect(parsed[1].inputs[0].connectionLimit).toBe(1)
      }
      if (parsed[1] && parsed[1].outputs && parsed[1].outputs[0]) {
        expect(parsed[1].outputs[0].connectionLimit).toBe(3)
      }
    })
  })
})
