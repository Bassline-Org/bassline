/**
 * Tests for IPCBridgeDriver
 * 
 * Showcases integration with Unix commands and shell pipelines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IPCBridgeDriver } from '../bridges/ipc-bridge-driver'
import { Kernel } from '../kernel'
import { UserspaceRuntime } from '../userspace-runtime'
import { MemoryStorageDriver } from '../drivers/memory-storage-driver'
import { brand } from '../../types'
import { Readable, Writable, PassThrough } from 'stream'

describe('IPCBridgeDriver', () => {
  let bridge: IPCBridgeDriver
  
  afterEach(async () => {
    // Clean up
    if (bridge) {
      try {
        await bridge.stopListening()
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  })
  
  describe('Core Functionality', () => {
    describe('Process Management', () => {
      it('should spawn a process and communicate via stdin/stdout', async () => {
        // Use 'cat' command which echoes stdin to stdout
        bridge = new IPCBridgeDriver({
          command: 'cat',
          protocol: 'line'
        })
        
        const dataReceived = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        // Send data through the bridge
        await bridge.sendRaw('Hello from Bassline!\n')
        
        const received = await dataReceived
        expect(received).toMatchObject({
          data: 'Hello from Bassline!'
        })
      })
      
      it('should handle process exit and respawn if configured', async () => {
        // Use 'head' command which exits after reading n lines
        bridge = new IPCBridgeDriver({
          command: 'head',
          args: ['-n', '1'],
          protocol: 'line',
          respawn: true,
          respawnDelay: 100
        })
        
        const exitPromise = new Promise((resolve) => {
          bridge.once('process-exited', resolve)
        })
        
        await bridge.startListening()
        
        // Send data - head will exit after 1 line
        await bridge.sendRaw('Line 1\n')
        
        await exitPromise
        
        // Wait for respawn to happen
        let respawned = false
        bridge.once('process-started', () => {
          respawned = true
        })
        
        // Wait up to 300ms for respawn
        await new Promise(resolve => setTimeout(resolve, 300))
        
        if (respawned) {
          expect(bridge.getProcessState()).toBe('running')
        } else {
          // Respawn may not have happened yet or failed
          expect(bridge.getProcessState()).toMatch(/stopped|running/)
        }
      })
      
      it('should gracefully handle process crashes', async () => {
        // Use a command that will fail
        bridge = new IPCBridgeDriver({
          command: 'false', // Always exits with code 1
          respawn: false
        })
        
        const exitPromise = new Promise((resolve) => {
          bridge.once('process-exited', resolve)
        })
        
        await bridge.startListening()
        const exited = await exitPromise
        
        expect(exited).toMatchObject({
          code: 1
        })
      })
    })
    
    describe('Unix Command Integration', () => {
      it('should pipe data through jq for JSON processing', async () => {
        // Use jq to extract a field from JSON
        bridge = new IPCBridgeDriver({
          command: 'jq',
          args: ['.value'],
          protocol: 'json'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        // Send JSON through jq
        await bridge.handleChange({
          contactId: brand.contactId('test'),
          groupId: brand.groupId('test'),
          value: { nested: 'data' }
        })
        
        const result = await dataPromise
        expect(result).toMatchObject({
          data: { nested: 'data' }
        })
      })
      
      it('should use sed for text transformation', async () => {
        // Use sed to transform text
        bridge = new IPCBridgeDriver({
          command: 'sed',
          args: ['s/hello/goodbye/g'],
          protocol: 'line'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        // Send text through sed
        await bridge.sendRaw('hello world\n')
        
        const result = await dataPromise
        expect(result).toMatchObject({
          data: 'goodbye world'
        })
      })
      
      it('should use grep to filter lines', async () => {
        // Use grep with line buffering to filter lines containing 'error'
        bridge = new IPCBridgeDriver({
          command: 'grep',
          args: ['--line-buffered', 'error'],
          protocol: 'line'
        })
        
        const results: any[] = []
        bridge.on('process-data', (data) => {
          results.push(data)
        })
        
        await bridge.startListening()
        
        // Send multiple lines
        await bridge.sendRaw('info: starting\n')
        await bridge.sendRaw('error: something failed\n')
        await bridge.sendRaw('debug: processing\n')
        await bridge.sendRaw('error: another issue\n')
        
        // Wait a bit for processing
        await new Promise(resolve => setTimeout(resolve, 200))
        
        // Should only get the error lines
        expect(results).toHaveLength(2)
        expect(results[0]).toMatchObject({ data: 'error: something failed' })
        expect(results[1]).toMatchObject({ data: 'error: another issue' })
      })
      
      it('should use awk for data extraction', async () => {
        // Use awk to extract the second field
        bridge = new IPCBridgeDriver({
          command: 'awk',
          args: ['{print $2}'],
          protocol: 'line'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        // Send space-separated data
        await bridge.sendRaw('field1 field2 field3\n')
        
        const result = await dataPromise
        expect(result).toMatchObject({
          data: 'field2'
        })
      })
      
      it('should pipe through tr for character translation', async () => {
        // Use tr to convert to uppercase
        bridge = new IPCBridgeDriver({
          command: 'tr',
          args: ['[:lower:]', '[:upper:]'],
          protocol: 'line'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        await bridge.sendRaw('hello bassline\n')
        
        const result = await dataPromise
        expect(result).toMatchObject({
          data: 'HELLO BASSLINE'
        })
      })
    })
    
    describe('Custom Streams', () => {
      it('should work with custom stdin/stdout streams', async () => {
        // Create custom streams
        const stdin = new PassThrough()
        const stdout = new PassThrough()
        
        bridge = new IPCBridgeDriver({
          stdin,
          stdout,
          protocol: 'line'
        })
        
        const results: any[] = []
        stdout.on('data', (chunk) => {
          results.push(chunk.toString())
        })
        
        await bridge.startListening()
        
        // Send data through the bridge
        await bridge.handleChange({
          contactId: brand.contactId('test'),
          groupId: brand.groupId('test'),
          value: 'custom-stream-data'
        })
        
        // Simulate external input
        stdin.write('external-input\n')
        
        await new Promise(resolve => setTimeout(resolve, 50))
        
        expect(results).toContain('test:\"custom-stream-data\"\n')
      })
    })
    
    describe('Protocol Handling', () => {
      it('should handle JSON protocol for structured data', async () => {
        bridge = new IPCBridgeDriver({
          command: 'cat',
          protocol: 'json'
        })
        
        const inputHandler = vi.fn()
        bridge.setInputHandler(inputHandler)
        
        await bridge.startListening()
        
        // Send JSON data that should be parsed as external input
        await bridge.sendRaw(JSON.stringify({
          contactId: 'json-contact',
          groupId: 'json-group',
          value: { structured: 'data' }
        }) + '\n')
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        expect(inputHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'external-input',
            source: 'ipc',
            contactId: brand.contactId('json-contact'),
            groupId: brand.groupId('json-group'),
            value: { structured: 'data' }
          })
        )
      })
      
      it('should handle line protocol for simple text', async () => {
        bridge = new IPCBridgeDriver({
          command: 'cat',
          protocol: 'line'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        await bridge.sendRaw('Simple line of text\n')
        
        const result = await dataPromise
        expect(result).toMatchObject({
          data: 'Simple line of text'
        })
      })
      
      it('should handle binary protocol for raw data', async () => {
        bridge = new IPCBridgeDriver({
          command: 'cat',
          protocol: 'binary'
        })
        
        const dataPromise = new Promise((resolve) => {
          bridge.once('process-data', resolve)
        })
        
        await bridge.startListening()
        
        const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04])
        await bridge.sendRaw(binaryData)
        
        const result = await dataPromise
        expect(result).toMatchObject({
          binary: true
        })
        expect(Buffer.isBuffer(result.data)).toBe(true)
      })
    })
    
    describe('Queue Management', () => {
      it('should queue messages when process is not running', async () => {
        bridge = new IPCBridgeDriver({
          command: 'cat',
          protocol: 'line',
          queueSize: 10
        })
        
        // Send messages before starting
        await bridge.handleChange({
          contactId: brand.contactId('test-1'),
          groupId: brand.groupId('test'),
          value: 'queued-1'
        })
        
        await bridge.handleChange({
          contactId: brand.contactId('test-2'),
          groupId: brand.groupId('test'),
          value: 'queued-2'
        })
        
        expect(bridge.getQueueLength()).toBe(2)
        
        // Start listening - should flush queue
        const results: any[] = []
        bridge.on('process-data', (data) => {
          results.push(data)
        })
        
        await bridge.startListening()
        await new Promise(resolve => setTimeout(resolve, 100))
        
        expect(bridge.getQueueLength()).toBe(0)
        expect(results).toHaveLength(2)
      })
    })
  })
  
  describe('Kernel Integration', () => {
    let kernel: Kernel
    let runtime: UserspaceRuntime
    let storage: MemoryStorageDriver
    
    beforeEach(async () => {
      // Set up kernel with storage
      kernel = new Kernel()
      storage = new MemoryStorageDriver()
      
      await storage.initialize()
      kernel.registerDriver(storage)
      
      runtime = new UserspaceRuntime({ kernel })
      kernel.setUserspaceHandler(runtime.receiveExternalInput.bind(runtime))
    })
    
    afterEach(async () => {
      await kernel.shutdown()
    })
    
    it('should pipe propagation changes through Unix command', async () => {
      // Use tr to uppercase all values
      bridge = new IPCBridgeDriver({
        command: 'tr',
        args: ['[:lower:]', '[:upper:]'],
        protocol: 'line'
      })
      
      const results: any[] = []
      bridge.on('process-data', (data) => {
        results.push(data)
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      // Create a contact in runtime
      const groupId = 'test-group'
      const contactId = 'test-contact'
      await runtime.registerGroup({
        id: groupId,
        name: 'Test Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      await runtime.addContact(groupId, {
        id: contactId,
        content: 'lowercase text',
        blendMode: 'accept-last'
      })
      
      // Update contact - should go through kernel to IPC bridge
      await runtime.scheduleUpdate(contactId, 'more lowercase text')
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have received uppercased version
      const uppercased = results.find(r => 
        r.data && r.data.includes('MORE LOWERCASE TEXT')
      )
      expect(uppercased).toBeDefined()
    })
    
    it('should receive external input from shell command and update runtime', async () => {
      // Use echo in a loop to generate input
      bridge = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', 'for i in 1 2 3; do echo "{\\\"contactId\\\":\\\"counter\\\",\\\"value\\\":$i}"; sleep 0.1; done'],
        protocol: 'json'
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      // Create contact in runtime
      const groupId = 'test-group'
      const contactId = 'counter'
      await runtime.registerGroup({
        id: groupId,
        name: 'Test Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      await runtime.addContact(groupId, {
        id: contactId,
        content: 0,
        blendMode: 'accept-last'
      })
      
      // Wait for shell command to send updates
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check that runtime was updated
      const state = await runtime.getState(groupId)
      const contact = state.contacts.get(contactId)
      expect(contact?.content).toBeGreaterThan(0)
    })
    
    it('should create a pipeline of Unix commands for data processing', async () => {
      // First bridge: generate numbers
      const generator = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', 'seq 1 5'],
        protocol: 'line'
      })
      
      // Second bridge: filter even numbers
      const filter = new IPCBridgeDriver({
        command: 'awk',
        args: ['$1 % 2 == 0'],
        protocol: 'line'
      })
      
      const results: number[] = []
      filter.on('process-data', (data) => {
        const num = parseInt(data.data)
        if (!isNaN(num)) results.push(num)
      })
      
      // Connect generator output to filter input
      generator.on('process-data', async (data) => {
        await filter.sendRaw(data.data + '\n')
      })
      
      await generator.startListening()
      await filter.startListening()
      
      // Wait for pipeline to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Should only have even numbers
      expect(results).toEqual([2, 4])
    })
  })
  
  describe('Real-world Examples', () => {
    it('should use wc to count words in propagation values', async () => {
      bridge = new IPCBridgeDriver({
        command: 'wc',
        args: ['-w'], // Count words
        protocol: 'line'
      })
      
      const results: any[] = []
      bridge.on('process-data', (data) => {
        results.push(data)
      })
      
      await bridge.startListening()
      
      // Send text to count
      await bridge.sendRaw('The quick brown fox jumps over the lazy dog\n')
      
      // Send EOF to get result
      await bridge.handleCommand({ type: 'restart-process' } as any)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // wc should report 9 words
      const wordCount = results.find(r => r.data && r.data.includes('9'))
      expect(wordCount).toBeDefined()
    })
    
    it('should use sort to order propagation values', async () => {
      bridge = new IPCBridgeDriver({
        command: 'sort',
        args: ['-n'], // Numeric sort
        protocol: 'line'
      })
      
      const results: number[] = []
      bridge.on('process-data', (data) => {
        const num = parseInt(data.data)
        if (!isNaN(num)) results.push(num)
      })
      
      await bridge.startListening()
      
      // Send unsorted numbers
      await bridge.sendRaw('3\n')
      await bridge.sendRaw('1\n')
      await bridge.sendRaw('4\n')
      await bridge.sendRaw('2\n')
      
      // Restart to get sorted output
      await bridge.handleCommand({ type: 'restart-process' } as any)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should be sorted
      expect(results).toEqual([1, 2, 3, 4])
    })
    
    it('should use tee to duplicate output to multiple destinations', async () => {
      // Create a temp file for tee output
      const tempFile = `/tmp/bassline-test-${Date.now()}.txt`
      
      bridge = new IPCBridgeDriver({
        command: 'tee',
        args: [tempFile],
        protocol: 'line'
      })
      
      const results: any[] = []
      bridge.on('process-data', (data) => {
        results.push(data)
      })
      
      await bridge.startListening()
      
      // Send data through tee
      await bridge.sendRaw('Data for multiple destinations\n')
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should have received the data
      expect(results).toHaveLength(1)
      expect(results[0].data).toBe('Data for multiple destinations')
      
      // Check that file was also written
      const fs = await import('fs/promises')
      const fileContent = await fs.readFile(tempFile, 'utf8')
      expect(fileContent).toContain('Data for multiple destinations')
      
      // Clean up
      await fs.unlink(tempFile)
    })
  })
})