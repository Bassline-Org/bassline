/**
 * HTTP-specific tests for slurp primitive with a real HTTP server
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Kernel } from '../kernel/kernel'
import { UserspaceRuntime } from '../kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '../kernel/drivers/primitive-loader-driver'
import { brand } from '../types'
import type { PrimitiveGadget } from '../types'
import * as http from 'http'
import type { Server } from 'http'

describe('HTTP Slurp with Real Server', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  let server: Server
  let serverPort: number
  
  beforeEach(async () => {
    // Set up kernel and runtime
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
    
    // Create a real HTTP server for testing
    server = http.createServer((req, res) => {
      console.log(`Test server received request: ${req.method} ${req.url}`)
      
      if (req.url === '/data.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: 'Hello from HTTP!', timestamp: Date.now() }))
      } else if (req.url === '/users.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ]))
      } else if (req.url === '/text.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('Plain text response from server')
      } else if (req.url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Internal Server Error')
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      }
    })
    
    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        serverPort = typeof address === 'object' && address ? address.port : 3000
        console.log(`Test HTTP server running on port ${serverPort}`)
        resolve()
      })
    })
  })
  
  afterEach(async () => {
    // Close the server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
  
  it('should fetch JSON data from HTTP endpoint', async () => {
    // Load HTTP-based slurp implementation
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => ({
        slurp: (): PrimitiveGadget => ({
          id: 'slurp',
          name: 'HTTP Slurp',
          inputs: ['source', 'trigger'],
          outputs: ['content', 'error', 'status'],
          activation: (inputs) => 
            inputs.has('source') && inputs.has('trigger'),
          body: async (inputs) => {
            const source = String(inputs.get('source'))
            
            try {
              const response = await fetch(source)
              
              if (!response.ok) {
                return new Map([
                  ['content', null],
                  ['error', `HTTP ${response.status}`],
                  ['status', response.status]
                ])
              }
              
              const contentType = response.headers.get('content-type') || ''
              let content
              
              if (contentType.includes('application/json')) {
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
    await runtime.scheduleUpdate(sourceInput!.id, `http://127.0.0.1:${serverPort}/data.json`)
    await runtime.scheduleUpdate(triggerInput!.id, true)
    
    // Wait for async propagation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Check the output
    const updatedState = await runtime.getState(slurpGadgetId)
    const content = updatedState.contacts.get(contentOutput!.id)?.content
    const status = updatedState.contacts.get(statusOutput!.id)?.content
    
    expect(content).toHaveProperty('data', 'Hello from HTTP!')
    expect(content).toHaveProperty('timestamp')
    expect(status).toBe(200)
  })
  
  it('should fetch plain text from HTTP endpoint', async () => {
    // Load HTTP slurp
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => ({
        slurp: (): PrimitiveGadget => ({
          id: 'slurp',
          name: 'HTTP Slurp',
          inputs: ['source', 'trigger'],
          outputs: ['content', 'error', 'status'],
          activation: (inputs) => 
            inputs.has('source') && inputs.has('trigger'),
          body: async (inputs) => {
            const source = String(inputs.get('source'))
            
            try {
              const response = await fetch(source)
              
              if (!response.ok) {
                return new Map([
                  ['content', null],
                  ['error', `HTTP ${response.status}`],
                  ['status', response.status]
                ])
              }
              
              const contentType = response.headers.get('content-type') || ''
              let content
              
              if (contentType.includes('application/json')) {
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
          isPure: false
        })
      }),
      namespace: '@io/http'
    })
    
    const rootGroupId = brand.groupId('root')
    await runtime.registerGroup({
      id: rootGroupId,
      name: 'Plain Text Test',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const slurpGadgetId = await runtime.createPrimitiveGadget('@io/http/slurp', rootGroupId)
    const gadgetState = await runtime.getState(slurpGadgetId)
    const sourceInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'source' && c.boundaryDirection === 'input')
    const triggerInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
    const contentOutput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'content' && c.boundaryDirection === 'output')
    
    // Fetch plain text
    await runtime.scheduleUpdate(sourceInput!.id, `http://127.0.0.1:${serverPort}/text.txt`)
    await runtime.scheduleUpdate(triggerInput!.id, true)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const updatedState = await runtime.getState(slurpGadgetId)
    const content = updatedState.contacts.get(contentOutput!.id)?.content
    
    expect(content).toBe('Plain text response from server')
  })
  
  it('should handle 404 errors correctly', async () => {
    // Load HTTP slurp
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => ({
        slurp: (): PrimitiveGadget => ({
          id: 'slurp',
          name: 'HTTP Slurp',
          inputs: ['source', 'trigger'],
          outputs: ['content', 'error', 'status'],
          activation: (inputs) => 
            inputs.has('source') && inputs.has('trigger'),
          body: async (inputs) => {
            const source = String(inputs.get('source'))
            
            try {
              const response = await fetch(source)
              
              if (!response.ok) {
                const errorText = await response.text()
                return new Map([
                  ['content', null],
                  ['error', `HTTP ${response.status}: ${errorText}`],
                  ['status', response.status]
                ])
              }
              
              const content = await response.text()
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
          isPure: false
        })
      }),
      namespace: '@io/http'
    })
    
    const rootGroupId = brand.groupId('root')
    await runtime.registerGroup({
      id: rootGroupId,
      name: 'HTTP 404 Test',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const slurpGadgetId = await runtime.createPrimitiveGadget('@io/http/slurp', rootGroupId)
    const gadgetState = await runtime.getState(slurpGadgetId)
    const sourceInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'source' && c.boundaryDirection === 'input')
    const triggerInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
    const errorOutput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'error' && c.boundaryDirection === 'output')
    const statusOutput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'status' && c.boundaryDirection === 'output')
    
    // Try to fetch non-existent resource
    await runtime.scheduleUpdate(sourceInput!.id, `http://127.0.0.1:${serverPort}/not-found`)
    await runtime.scheduleUpdate(triggerInput!.id, true)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const updatedState = await runtime.getState(slurpGadgetId)
    const error = updatedState.contacts.get(errorOutput!.id)?.content
    const status = updatedState.contacts.get(statusOutput!.id)?.content
    
    expect(error).toBe('HTTP 404: Not Found')
    expect(status).toBe(404)
  })
  
  it('should handle server errors correctly', async () => {
    // Load HTTP slurp
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => ({
        slurp: (): PrimitiveGadget => ({
          id: 'slurp',
          name: 'HTTP Slurp',
          inputs: ['source', 'trigger'],
          outputs: ['content', 'error', 'status'],
          activation: (inputs) => 
            inputs.has('source') && inputs.has('trigger'),
          body: async (inputs) => {
            const source = String(inputs.get('source'))
            
            try {
              const response = await fetch(source)
              
              if (!response.ok) {
                const errorText = await response.text()
                return new Map([
                  ['content', null],
                  ['error', `HTTP ${response.status}: ${errorText}`],
                  ['status', response.status]
                ])
              }
              
              const content = await response.text()
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
          isPure: false
        })
      }),
      namespace: '@io/http'
    })
    
    const rootGroupId = brand.groupId('root')
    await runtime.registerGroup({
      id: rootGroupId,
      name: 'HTTP 500 Test',
      contactIds: [],
      wireIds: [],
      subgroupIds: [],
      boundaryContactIds: []
    })
    
    const slurpGadgetId = await runtime.createPrimitiveGadget('@io/http/slurp', rootGroupId)
    const gadgetState = await runtime.getState(slurpGadgetId)
    const sourceInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'source' && c.boundaryDirection === 'input')
    const triggerInput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
    const errorOutput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'error' && c.boundaryDirection === 'output')
    const statusOutput = Array.from(gadgetState.contacts.values())
      .find(c => c.name === 'status' && c.boundaryDirection === 'output')
    
    // Try to fetch error endpoint
    await runtime.scheduleUpdate(sourceInput!.id, `http://127.0.0.1:${serverPort}/error`)
    await runtime.scheduleUpdate(triggerInput!.id, true)
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const updatedState = await runtime.getState(slurpGadgetId)
    const error = updatedState.contacts.get(errorOutput!.id)?.content
    const status = updatedState.contacts.get(statusOutput!.id)?.content
    
    expect(error).toBe('HTTP 500: Internal Server Error')
    expect(status).toBe(500)
  })
})