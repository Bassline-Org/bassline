import { describe, it, expect, beforeEach } from 'vitest'
import { Gadget, Network } from '../gadgets'
import { Nothing } from '../terms'

describe('Gadgets', () => {
  let network: Network
  let gadget: Gadget

  beforeEach(() => {
    network = new Network('test-network')
    gadget = new Gadget('test-gadget', network)
  })

  describe('Basic Gadget Functionality', () => {
    it('should create gadget with control port', () => {
      const controlPort = gadget.getPort('control')
      expect(controlPort).toBeDefined()
      expect(controlPort?.direction).toBe('input')
      expect(controlPort?.gadget).toBe(gadget)
    })

    it('should be added to network', () => {
      const networkGadget = network.getGadget('test-gadget')
      expect(networkGadget).toBe(gadget)
    })
  })

  describe('Interface Management', () => {
    it('should set interface and create ports', () => {
      const interfaceCommand = ['setInterface', {
        inputs: [
          { name: 'input1', value: 42, connectionLimit: 1 },
          { name: 'input2', connectionLimit: 2 }
        ],
        outputs: [
          { name: 'output1', connectionLimit: 3 },
          { name: 'output2', connectionLimit: null }
        ]
      }]

      gadget.receive('control', interfaceCommand)

      // Check that ports were created
      expect(gadget.getPort('input1')).toBeDefined()
      expect(gadget.getPort('input2')).toBeDefined()
      expect(gadget.getPort('output1')).toBeDefined()
      expect(gadget.getPort('output2')).toBeDefined()

      // Check port properties
      const input1 = gadget.getPort('input1')!
      expect(input1.direction).toBe('input')
      expect(input1.value).toBe(42)
      expect(input1.name).toBe('input1')

      const output1 = gadget.getPort('output1')!
      expect(output1.direction).toBe('output')
      expect(output1.value).toBe(Nothing)
    })

    it('should store interface for later access', () => {
      const interfaceCommand = ['setInterface', {
        inputs: [{ name: 'input1' }],
        outputs: [{ name: 'output1' }]
      }]

      gadget.receive('control', interfaceCommand)

      const interface_ = gadget.getInterface()
      expect(interface_).toBeDefined()
      if (interface_) {
        expect(interface_.inputs).toHaveLength(1)
        expect(interface_.outputs).toHaveLength(1)
        if (interface_.inputs[0] && interface_.outputs[0]) {
          expect(interface_.inputs[0].name).toBe('input1')
          expect(interface_.outputs[0].name).toBe('output1')
        }
      }
    })

    it('should apply connection limits from interface', () => {
      const interfaceCommand = ['setInterface', {
        inputs: [{ name: 'input1', connectionLimit: 1 }],
        outputs: [{ name: 'output1', connectionLimit: 2 }]
      }]

      gadget.receive('control', interfaceCommand)

      const input1 = gadget.getPort('input1')!
      const output1 = gadget.getPort('output1')!

      // Test input connection limit
      input1.connectTo(['gadget1', 'out'])
      expect(() => input1.connectTo(['gadget2', 'out'])).toThrow()

      // Test output connection limit
      output1.connectTo(['gadget1', 'in'])
      output1.connectTo(['gadget2', 'in'])
      expect(() => output1.connectTo(['gadget3', 'in'])).toThrow()
    })
  })

  describe('Input Handler Management', () => {
    it('should set input handlers', () => {
      const handler = (_self: Gadget, _value: any) => {}
      const handlerCommand = ['set-input-handler', 'input1', ['handler1', handler]]

      gadget.receive('control', handlerCommand)

      const retrievedHandler = gadget.getInputHandler('input1')
      expect(retrievedHandler).toBe(handler)
    })
  })

  describe('Connection Management', () => {
    beforeEach(() => {
      // Set up basic interface first
      gadget.receive('control', ['setInterface', {
        inputs: [{ name: 'input1' }],
        outputs: [{ name: 'output1' }]
      }])
    })

    it('should connect ports', () => {
      const connectCommand = ['connect', 'output1', ['targetGadget', 'targetPort']]
      
      gadget.receive('control', connectCommand)

      const output1 = gadget.getPort('output1')!
      const connections = output1.getConnections()
      expect(connections).toHaveLength(1)
      expect(connections[0]).toEqual(['targetGadget', 'targetPort'])
    })

    it('should connect and sync ports', () => {
      const connectAndSyncCommand = ['connect-and-sync', 'output1', ['targetGadget', 'targetPort']]
      
      // Set a value on the output port
      const output1 = gadget.getPort('output1')!
      output1.accept(42)
      
      gadget.receive('control', connectAndSyncCommand)

      const connections = output1.getConnections()
      expect(connections).toHaveLength(1)
      expect(connections[0]).toEqual(['targetGadget', 'targetPort'])
    })
  })

  describe('Batch Commands', () => {
    it('should process batch commands', () => {
      const batchCommand = ['batch', [
        ['setInterface', {
          inputs: [{ name: 'input1' }],
          outputs: [{ name: 'output1' }]
        }],
        ['connect', 'output1', ['targetGadget', 'targetPort']]
      ]]

      gadget.receive('control', batchCommand)

      // Check that interface was set
      expect(gadget.getPort('input1')).toBeDefined()
      expect(gadget.getPort('output1')).toBeDefined()

      // Check that connection was made
      const output1 = gadget.getPort('output1')!
      const connections = output1.getConnections()
      expect(connections).toHaveLength(1)
      expect(connections[0]).toEqual(['targetGadget', 'targetPort'])
    })
  })

  describe('Port Value Management', () => {
    beforeEach(() => {
      gadget.receive('control', ['setInterface', {
        inputs: [{ name: 'input1' }],
        outputs: [{ name: 'output1' }]
      }])
    })

    it('should emit values to output ports', () => {
      const output1 = gadget.getPort('output1')!
      
      gadget.emit('output1', 42)
      expect(output1.value).toBe(42)
    })

    it('should throw error when emitting to non-existent port', () => {
      expect(() => gadget.emit('nonexistent', 42)).toThrow('Unknown port: nonexistent')
    })

    it('should throw error when emitting to input port', () => {
      expect(() => gadget.emit('input1', 42)).toThrow('Cannot emit to input port: input1')
    })
  })
})
