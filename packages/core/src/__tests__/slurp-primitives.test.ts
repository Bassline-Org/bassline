/**
 * Tests for "slurp" primitive - a versatile I/O primitive inspired by Clojure
 * 
 * Demonstrates how the same primitive interface can be implemented with
 * different I/O backends (file system, HTTP, mock data, etc.)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Kernel } from '../kernel/kernel'
import { UserspaceRuntime } from '../kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '../kernel/drivers/primitive-loader-driver'
import { brand } from '../types'
import type { PrimitiveGadget } from '../types'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Slurp Primitives - Polymorphic I/O', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  
  beforeEach(async () => {
    kernel = new Kernel({ debug: false })
    runtime = new UserspaceRuntime({ kernel })
    
    await kernel.initializeSystemDrivers()
    kernel.setUserspaceRuntime(runtime)
    
    primitiveLoader = kernel.getPrimitiveLoader()!
    runtime.setPrimitiveLoader(primitiveLoader)
    
    const schedulerDriver = kernel.getSchedulerDriver()
    if (schedulerDriver) {
      runtime.setSchedulerDriver(schedulerDriver)
    }
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  describe('File System Slurp', () => {
    it('should read file contents from the file system', async () => {
      // Create a temp file for testing
      const testContent = 'Hello from the file system!'
      const testFile = '/tmp/test-slurp.txt'
      await fs.writeFile(testFile, testContent, 'utf-8')
      
      // Load file-based slurp implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'File Slurp',
            inputs: ['source', 'trigger'],
            outputs: ['content', 'error'],
            activation: (inputs) => 
              inputs.has('source') && inputs.has('trigger'),
            body: async (inputs) => {
              const source = String(inputs.get('source'))
              
              try {
                // File system implementation
                const content = await fs.readFile(source, 'utf-8')
                return new Map([
                  ['content', content],
                  ['error', null]
                ])
              } catch (error) {
                return new Map([
                  ['content', null],
                  ['error', error instanceof Error ? error.message : String(error)]
                ])
              }
            },
            description: 'Reads content from a file',
            category: 'io',
            isPure: false // File I/O is impure
          })
        }),
        namespace: '@io/file'
      })
      
      // Create network
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'File Slurp Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/file/slurp', rootGroupId)
      
      // Get boundary contacts
      const gadgetState = await runtime.getState(slurpGadgetId)
      const sourceInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      const errorOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      // Set the file path and trigger
      await runtime.scheduleUpdate(sourceInput!.id, testFile)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Check the output
      const updatedState = await runtime.getState(slurpGadgetId)
      const content = updatedState.contacts.get(contentOutput!.id)?.content
      const error = updatedState.contacts.get(errorOutput!.id)?.content
      
      expect(content).toBe(testContent)
      expect(error).toBeNull()
      
      // Clean up
      await fs.unlink(testFile)
    })
    
    it('should handle file not found errors gracefully', async () => {
      // Load file-based slurp
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'File Slurp',
            inputs: ['source', 'trigger'],
            outputs: ['content', 'error'],
            activation: (inputs) => 
              inputs.has('source') && inputs.has('trigger'),
            body: async (inputs) => {
              const source = String(inputs.get('source'))
              
              try {
                const content = await fs.readFile(source, 'utf-8')
                return new Map([
                  ['content', content],
                  ['error', null]
                ])
              } catch (error) {
                return new Map([
                  ['content', null],
                  ['error', error instanceof Error ? error.message : String(error)]
                ])
              }
            },
            description: 'Reads content from a file',
            category: 'io',
            isPure: false
          })
        }),
        namespace: '@io/file'
      })
      
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'File Error Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/file/slurp', rootGroupId)
      
      const gadgetState = await runtime.getState(slurpGadgetId)
      const sourceInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const errorOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      
      // Try to read non-existent file
      await runtime.scheduleUpdate(sourceInput!.id, '/this/file/does/not/exist.txt')
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      const updatedState = await runtime.getState(slurpGadgetId)
      const error = updatedState.contacts.get(errorOutput!.id)?.content
      
      expect(error).toContain('ENOENT')
    })
  })
  
  describe('HTTP Slurp', () => {
    it('should fetch content from HTTP endpoints', async () => {
      // Mock fetch for testing
      const mockResponse = { data: 'Hello from HTTP!' }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse)
      })
      
      // Load HTTP-based slurp implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'HTTP Slurp',
            inputs: ['source', 'trigger', 'options'],
            outputs: ['content', 'error', 'status'],
            activation: (inputs) => 
              inputs.has('source') && inputs.has('trigger'),
            body: async (inputs) => {
              const source = String(inputs.get('source'))
              const options = inputs.get('options') || {}
              
              try {
                // HTTP implementation
                const response = await fetch(source, options as RequestInit)
                
                if (!response.ok) {
                  return new Map([
                    ['content', null],
                    ['error', `HTTP ${response.status}`],
                    ['status', response.status]
                  ])
                }
                
                const contentType = response.headers?.get?.('content-type') || 'text/plain'
                let content
                
                if (contentType?.includes('application/json')) {
                  content = await response.json()
                } else {
                  content = await response.text()
                }
                
                return new Map([
                  ['content', content],
                  ['error', null],
                  ['status', response.status]
                ])
              } catch (error) {
                return new Map([
                  ['content', null],
                  ['error', error instanceof Error ? error.message : String(error)],
                  ['status', 0]
                ])
              }
            },
            description: 'Fetches content from HTTP endpoints',
            category: 'io',
            isPure: false // Network I/O is impure
          })
        }),
        namespace: '@io/http'
      })
      
      // Create network
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'HTTP Slurp Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/http/slurp', rootGroupId)
      
      // Get boundary contacts
      const gadgetState = await runtime.getState(slurpGadgetId)
      const sourceInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      const statusOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'status' && c.boundaryDirection === 'output')
      
      // Fetch from our test server
      await runtime.scheduleUpdate(sourceInput!.id, `http://localhost:${serverPort}/data.json`)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait a moment for async propagation
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // Check the output
      const updatedState = await runtime.getState(slurpGadgetId)
      const content = updatedState.contacts.get(contentOutput!.id)?.content
      const status = updatedState.contacts.get(statusOutput!.id)?.content
      
      expect(content).toEqual({ data: 'Hello from HTTP!' })
      expect(status).toBe(200)
    })
  })
  
  describe('Mock Slurp for Testing', () => {
    it('should provide mock data for testing', async () => {
      // Load mock slurp implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'Mock Slurp',
            inputs: ['source', 'trigger'],
            outputs: ['content', 'error'],
            activation: (inputs) => 
              inputs.has('source') && inputs.has('trigger'),
            body: async (inputs) => {
              const source = String(inputs.get('source'))
              
              // Mock implementation - returns predefined data based on source
              const mockData: Record<string, any> = {
                '/users': [
                  { id: 1, name: 'Alice' },
                  { id: 2, name: 'Bob' }
                ],
                '/config': {
                  apiUrl: 'https://api.example.com',
                  timeout: 5000
                },
                '/README.md': '# Test Project\n\nThis is a test.'
              }
              
              if (source in mockData) {
                return new Map([
                  ['content', mockData[source]],
                  ['error', null]
                ])
              } else {
                return new Map([
                  ['content', null],
                  ['error', 'Mock data not found']
                ])
              }
            },
            description: 'Returns mock data for testing',
            category: 'io',
            isPure: true // Mock is actually pure!
          })
        }),
        namespace: '@io/mock'
      })
      
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Mock Slurp Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/mock/slurp', rootGroupId)
      
      const gadgetState = await runtime.getState(slurpGadgetId)
      const sourceInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(gadgetState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Get mock users data
      await runtime.scheduleUpdate(sourceInput!.id, '/users')
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      const updatedState = await runtime.getState(slurpGadgetId)
      const content = updatedState.contacts.get(contentOutput!.id)?.content
      
      expect(content).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ])
    })
  })
  
  describe('Swapping Slurp Implementations', () => {
    it('should use different backends based on loaded module', async () => {
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp Swap Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Test 1: Load mock implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'Universal Slurp',
            inputs: ['source', 'trigger'],
            outputs: ['content', 'error'],
            activation: (inputs) => inputs.has('source') && inputs.has('trigger'),
            body: async () => new Map([
              ['content', 'Mock data'],
              ['error', null]
            ]),
            description: 'Mock implementation',
            category: 'io',
            isPure: true
          })
        }),
        namespace: '@io/universal'
      })
      
      const mockSlurp = await runtime.createPrimitiveGadget('@io/universal/slurp', rootGroupId)
      const mockState = await runtime.getState(mockSlurp)
      const mockSource = Array.from(mockState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const mockTrigger = Array.from(mockState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const mockContent = Array.from(mockState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Set source and trigger
      await runtime.scheduleUpdate(mockSource!.id, 'test')
      await runtime.scheduleUpdate(mockTrigger!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const mockResult = (await runtime.getState(mockSlurp)).contacts.get(mockContent!.id)?.content
      expect(mockResult).toBe('Mock data')
      
      // Test 2: Reload with different implementation
      await primitiveLoader.loadModule({
        type: 'builtin',
        module: async () => ({
          slurp: (): PrimitiveGadget => ({
            id: 'slurp',
            name: 'Universal Slurp',
            inputs: ['source', 'trigger'],
            outputs: ['content', 'error'],
            activation: (inputs) => inputs.has('source') && inputs.has('trigger'),
            body: async (inputs) => {
              const source = String(inputs.get('source'))
              
              // This version checks the source and decides what to do
              if (source.startsWith('http://') || source.startsWith('https://')) {
                return new Map([
                  ['content', 'HTTP backend would fetch this'],
                  ['error', null]
                ])
              } else if (source.startsWith('/') || source.includes('.')) {
                return new Map([
                  ['content', 'File backend would read this'],
                  ['error', null]
                ])
              } else {
                return new Map([
                  ['content', null],
                  ['error', 'Unknown source type']
                ])
              }
            },
            description: 'Smart routing implementation',
            category: 'io',
            isPure: false
          })
        }),
        namespace: '@io/universal'
      })
      
      // Create new gadget with updated implementation
      const smartSlurp = await runtime.createPrimitiveGadget('@io/universal/slurp', rootGroupId)
      const smartState = await runtime.getState(smartSlurp)
      const smartSource = Array.from(smartState.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const smartTrigger = Array.from(smartState.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const smartContent = Array.from(smartState.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Test HTTP detection
      await runtime.scheduleUpdate(smartSource!.id, 'https://api.example.com')
      await runtime.scheduleUpdate(smartTrigger!.id, true)
      
      const httpResult = (await runtime.getState(smartSlurp)).contacts.get(smartContent!.id)?.content
      expect(httpResult).toBe('HTTP backend would fetch this')
      
      // Test file detection
      await runtime.scheduleUpdate(smartSource!.id, '/etc/config.json')
      await runtime.scheduleUpdate(smartTrigger!.id, Date.now()) // Retrigger with new value
      
      const fileResult = (await runtime.getState(smartSlurp)).contacts.get(smartContent!.id)?.content
      expect(fileResult).toBe('File backend would read this')
    })
  })
})