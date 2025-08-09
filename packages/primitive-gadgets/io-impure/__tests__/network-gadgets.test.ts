/**
 * Tests for network gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime } from '@bassline/core/src/kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '@bassline/core/src/kernel/drivers/primitive-loader-driver'
import { brand } from '@bassline/core'
import * as http from 'http'
import type { Server } from 'http'
import * as networkGadgets from '../src/network'

describe('Network Gadgets', () => {
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
    
    // Load network gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => networkGadgets,
      namespace: '@io/network'
    })
    
    // Create test HTTP server
    server = http.createServer((req, res) => {
      const url = req.url || '/'
      
      if (url === '/json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Hello from server', timestamp: Date.now() }))
      } else if (url === '/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('Plain text response')
      } else if (url === '/echo' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ 
            received: JSON.parse(body),
            method: req.method,
            headers: req.headers
          }))
        })
      } else if (url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Server Error')
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
        resolve()
      })
    })
  })
  
  afterEach(async () => {
    // Close server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
  
  describe('httpGet', () => {
    it('should fetch JSON data from HTTP endpoint', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'HTTP GET Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create httpGet gadget
      const getGadgetId = await runtime.createPrimitiveGadget('@io/network/httpGet', rootGroupId)
      const state = await runtime.getState(getGadgetId)
      
      const urlInput = Array.from(state.contacts.values())
        .find(c => c.name === 'url' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const responseOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'response' && c.boundaryDirection === 'output')
      const statusOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'status' && c.boundaryDirection === 'output')
      
      // Make request
      await runtime.scheduleUpdate(urlInput!.id, `http://127.0.0.1:${serverPort}/json`)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check results
      const result = await runtime.getState(getGadgetId)
      const response = result.contacts.get(responseOutput!.id)?.content as any
      const status = result.contacts.get(statusOutput!.id)?.content
      
      expect(response).toHaveProperty('message', 'Hello from server')
      expect(response).toHaveProperty('timestamp')
      expect(status).toBe(200)
    })
    
    it('should handle 404 errors correctly', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'HTTP 404 Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create httpGet gadget
      const getGadgetId = await runtime.createPrimitiveGadget('@io/network/httpGet', rootGroupId)
      const state = await runtime.getState(getGadgetId)
      
      const urlInput = Array.from(state.contacts.values())
        .find(c => c.name === 'url' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const errorOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'error' && c.boundaryDirection === 'output')
      const statusOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'status' && c.boundaryDirection === 'output')
      
      // Make request to non-existent endpoint
      await runtime.scheduleUpdate(urlInput!.id, `http://127.0.0.1:${serverPort}/not-found`)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check results
      const result = await runtime.getState(getGadgetId)
      const error = result.contacts.get(errorOutput!.id)?.content
      const status = result.contacts.get(statusOutput!.id)?.content
      
      expect(error).toBe('HTTP 404')
      expect(status).toBe(404)
    })
  })
  
  describe('httpPost', () => {
    it('should post JSON data and receive response', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'HTTP POST Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create httpPost gadget
      const postGadgetId = await runtime.createPrimitiveGadget('@io/network/httpPost', rootGroupId)
      const state = await runtime.getState(postGadgetId)
      
      const urlInput = Array.from(state.contacts.values())
        .find(c => c.name === 'url' && c.boundaryDirection === 'input')
      const dataInput = Array.from(state.contacts.values())
        .find(c => c.name === 'data' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const responseOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'response' && c.boundaryDirection === 'output')
      
      // Post data
      const testData = { test: 'data', number: 42 }
      await runtime.scheduleUpdate(urlInput!.id, `http://127.0.0.1:${serverPort}/echo`)
      await runtime.scheduleUpdate(dataInput!.id, testData)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check results
      const result = await runtime.getState(postGadgetId)
      const response = result.contacts.get(responseOutput!.id)?.content as any
      
      expect(response).toHaveProperty('received')
      expect(response.received).toEqual(testData)
      expect(response.method).toBe('POST')
    })
  })
  
  describe('httpFetch', () => {
    it('should support different HTTP methods', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'HTTP Fetch Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create httpFetch gadget
      const fetchGadgetId = await runtime.createPrimitiveGadget('@io/network/httpFetch', rootGroupId)
      const state = await runtime.getState(fetchGadgetId)
      
      const urlInput = Array.from(state.contacts.values())
        .find(c => c.name === 'url' && c.boundaryDirection === 'input')
      const methodInput = Array.from(state.contacts.values())
        .find(c => c.name === 'method' && c.boundaryDirection === 'input')
      const bodyInput = Array.from(state.contacts.values())
        .find(c => c.name === 'body' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const responseOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'response' && c.boundaryDirection === 'output')
      
      // Make POST request with custom method
      await runtime.scheduleUpdate(urlInput!.id, `http://127.0.0.1:${serverPort}/echo`)
      await runtime.scheduleUpdate(methodInput!.id, 'POST')
      await runtime.scheduleUpdate(bodyInput!.id, { custom: 'payload' })
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check results
      const result = await runtime.getState(fetchGadgetId)
      const response = result.contacts.get(responseOutput!.id)?.content as any
      
      expect(response).toHaveProperty('received')
      expect(response.received).toEqual({ custom: 'payload' })
    })
  })
})