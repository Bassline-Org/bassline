/**
 * Simple tests for IPCBridgeDriver to verify core functionality
 */

import { describe, it, expect, afterEach } from 'vitest'
import { IPCBridgeDriver } from '../bridges/ipc-bridge-driver'
import { brand } from '../../types'

describe('IPCBridgeDriver - Simple Tests', () => {
  let bridge: IPCBridgeDriver
  
  afterEach(async () => {
    if (bridge) {
      try {
        await bridge.stopListening()
      } catch (error) {
        // Ignore
      }
    }
  })
  
  it('should work with cat command', async () => {
    bridge = new IPCBridgeDriver({
      command: 'cat',
      protocol: 'line'
    })
    
    const results: any[] = []
    bridge.on('process-data', (data) => {
      results.push(data)
    })
    
    await bridge.startListening()
    await bridge.sendRaw('Hello, Bassline!\n')
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(results).toHaveLength(1)
    expect(results[0].data).toBe('Hello, Bassline!')
  })
  
  it('should handle ContactChange messages', async () => {
    bridge = new IPCBridgeDriver({
      command: 'cat',
      protocol: 'json'
    })
    
    const results: any[] = []
    bridge.on('process-data', (data) => {
      results.push(data)
    })
    
    await bridge.startListening()
    
    await bridge.handleChange({
      contactId: brand.contactId('test-contact'),
      groupId: brand.groupId('test-group'),
      value: 'test-value'
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(results).toHaveLength(1)
    expect(results[0].data).toMatchObject({
      contactId: 'test-contact',
      value: 'test-value'
    })
  })
  
  it('should work with echo command', async () => {
    bridge = new IPCBridgeDriver({
      command: 'echo',
      args: ['Hello from echo'],
      protocol: 'line'
    })
    
    const results: any[] = []
    bridge.on('process-data', (data) => {
      results.push(data)
    })
    
    await bridge.startListening()
    
    // Echo doesn't read stdin, it just outputs its args
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(results).toHaveLength(1)
    expect(results[0].data).toBe('Hello from echo')
  })
  
  it('should handle process info commands', async () => {
    bridge = new IPCBridgeDriver({
      command: 'cat',
      protocol: 'line'
    })
    
    await bridge.startListening()
    
    const info = await bridge.handleCommand({ type: 'get-process-info' } as any)
    
    expect(info.status).toBe('success')
    expect(info.data).toMatchObject({
      state: 'running',
      respawnCount: 0,
      queueLength: 0
    })
    expect(info.data.pid).toBeGreaterThan(0)
  })
  
  it('should convert incoming JSON to ExternalInput', async () => {
    bridge = new IPCBridgeDriver({
      command: 'cat',
      protocol: 'json'
    })
    
    const inputs: any[] = []
    bridge.setInputHandler(async (input) => {
      inputs.push(input)
    })
    
    await bridge.startListening()
    
    // Send a properly formatted message that should be converted to ExternalInput
    await bridge.sendRaw(JSON.stringify({
      contactId: 'input-contact',
      groupId: 'input-group',
      value: 42
    }) + '\n')
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatchObject({
      type: 'external-input',
      source: 'ipc',
      contactId: brand.contactId('input-contact'),
      groupId: brand.groupId('input-group'),
      value: 42
    })
  })
  
  it('should handle tr command for uppercase conversion', async () => {
    bridge = new IPCBridgeDriver({
      command: 'tr',
      args: ['a-z', 'A-Z'],  // More portable than [:lower:] [:upper:]
      protocol: 'binary'  // tr outputs as it processes, not line-by-line
    })
    
    const results: any[] = []
    bridge.on('process-data', (data) => {
      results.push(data)
    })
    
    await bridge.startListening()
    
    // tr processes character by character, so we need to be careful
    await bridge.sendRaw('hello\n')
    
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // tr outputs as binary chunks
    expect(results.length).toBeGreaterThan(0)
    const combined = results
      .map(r => r.data)
      .filter(d => d) // Filter out undefined
      .map(d => Buffer.isBuffer(d) ? d.toString() : String(d))
      .join('')
    expect(combined).toContain('HELLO')
  })
})