/**
 * Tests for polymorphic slurp/spit gadgets using real propagation networks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Kernel } from '@bassline/core'
import { UserspaceRuntime } from '@bassline/core/src/kernel/userspace-runtime'
import { PrimitiveLoaderDriver } from '@bassline/core/src/kernel/drivers/primitive-loader-driver'
import { brand } from '@bassline/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as http from 'http'
import type { Server } from 'http'
import * as slurpGadgets from '../src/slurp'

describe('Slurp/Spit Gadgets', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let primitiveLoader: PrimitiveLoaderDriver
  let testDir: string
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
    
    // Create temp directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'slurp-test-'))
    
    // Load slurp gadgets
    await primitiveLoader.loadModule({
      type: 'builtin',
      module: async () => slurpGadgets,
      namespace: '@io/slurp'
    })
    
    // Create test HTTP server
    server = http.createServer((req, res) => {
      const url = req.url || '/'
      
      if (url === '/data.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ source: 'http', data: 'test' }))
      } else if (url === '/text.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('Plain text from HTTP')
      } else if (url === '/upload' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end('Upload received')
        })
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })
    
    // Start server
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        serverPort = typeof address === 'object' && address ? address.port : 3000
        resolve()
      })
    })
  })
  
  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Failed to clean up test directory:', error)
    }
    
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  })
  
  describe('slurp', () => {
    it('should read from local file', async () => {
      // Create test file
      const testFile = path.join(testDir, 'test.txt')
      const testContent = 'Content from file'
      await fs.writeFile(testFile, testContent)
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp File Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/slurp/slurp', rootGroupId)
      const state = await runtime.getState(slurpGadgetId)
      
      const sourceInput = Array.from(state.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Slurp from file
      await runtime.scheduleUpdate(sourceInput!.id, testFile)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(slurpGadgetId)
      const content = result.contacts.get(contentOutput!.id)?.content
      expect(content).toBe(testContent)
    })
    
    it('should read from HTTP URL', async () => {
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp HTTP Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/slurp/slurp', rootGroupId)
      const state = await runtime.getState(slurpGadgetId)
      
      const sourceInput = Array.from(state.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Slurp from HTTP
      await runtime.scheduleUpdate(sourceInput!.id, `http://127.0.0.1:${serverPort}/data.json`)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check result
      const result = await runtime.getState(slurpGadgetId)
      const content = result.contacts.get(contentOutput!.id)?.content as any
      expect(content).toEqual({ source: 'http', data: 'test' })
    })
    
    it('should read from file:// URL', async () => {
      // Create test file
      const testFile = path.join(testDir, 'url-test.txt')
      const testContent = 'Content via file URL'
      await fs.writeFile(testFile, testContent)
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp File URL Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/slurp/slurp', rootGroupId)
      const state = await runtime.getState(slurpGadgetId)
      
      const sourceInput = Array.from(state.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Slurp from file URL
      await runtime.scheduleUpdate(sourceInput!.id, `file://${testFile}`)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(slurpGadgetId)
      const content = result.contacts.get(contentOutput!.id)?.content
      expect(content).toBe(testContent)
    })
    
    it('should parse JSON files automatically', async () => {
      // Create JSON file
      const testFile = path.join(testDir, 'data.json')
      const testData = { key: 'value', number: 42 }
      await fs.writeFile(testFile, JSON.stringify(testData))
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp JSON Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/slurp/slurp', rootGroupId)
      const state = await runtime.getState(slurpGadgetId)
      
      const sourceInput = Array.from(state.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Slurp JSON file
      await runtime.scheduleUpdate(sourceInput!.id, testFile)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result - should be parsed object, not string
      const result = await runtime.getState(slurpGadgetId)
      const content = result.contacts.get(contentOutput!.id)?.content
      expect(content).toEqual(testData)
    })
    
    it('should decode data URLs', async () => {
      const testContent = 'Hello from data URL'
      const dataUrl = `data:text/plain;base64,${Buffer.from(testContent).toString('base64')}`
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Slurp Data URL Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create slurp gadget
      const slurpGadgetId = await runtime.createPrimitiveGadget('@io/slurp/slurp', rootGroupId)
      const state = await runtime.getState(slurpGadgetId)
      
      const sourceInput = Array.from(state.contacts.values())
        .find(c => c.name === 'source' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const contentOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'output')
      
      // Slurp from data URL
      await runtime.scheduleUpdate(sourceInput!.id, dataUrl)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check result
      const result = await runtime.getState(slurpGadgetId)
      const content = result.contacts.get(contentOutput!.id)?.content
      expect(content).toBe(testContent)
    })
  })
  
  describe('spit', () => {
    it('should write to local file', async () => {
      const testFile = path.join(testDir, 'output.txt')
      const testContent = 'Content to write'
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Spit File Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create spit gadget
      const spitGadgetId = await runtime.createPrimitiveGadget('@io/slurp/spit', rootGroupId)
      const state = await runtime.getState(spitGadgetId)
      
      const destinationInput = Array.from(state.contacts.values())
        .find(c => c.name === 'destination' && c.boundaryDirection === 'input')
      const contentInput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const successOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'success' && c.boundaryDirection === 'output')
      
      // Spit to file
      await runtime.scheduleUpdate(destinationInput!.id, testFile)
      await runtime.scheduleUpdate(contentInput!.id, testContent)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check success
      const result = await runtime.getState(spitGadgetId)
      const success = result.contacts.get(successOutput!.id)?.content
      expect(success).toBe(true)
      
      // Verify file was created
      const actualContent = await fs.readFile(testFile, 'utf-8')
      expect(actualContent).toBe(testContent)
    })
    
    it('should write JSON objects as formatted JSON', async () => {
      const testFile = path.join(testDir, 'output.json')
      const testData = { key: 'value', nested: { data: true } }
      
      // Create root group
      const rootGroupId = brand.groupId('root')
      await runtime.registerGroup({
        id: rootGroupId,
        name: 'Spit JSON Test',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create spit gadget
      const spitGadgetId = await runtime.createPrimitiveGadget('@io/slurp/spit', rootGroupId)
      const state = await runtime.getState(spitGadgetId)
      
      const destinationInput = Array.from(state.contacts.values())
        .find(c => c.name === 'destination' && c.boundaryDirection === 'input')
      const contentInput = Array.from(state.contacts.values())
        .find(c => c.name === 'content' && c.boundaryDirection === 'input')
      const triggerInput = Array.from(state.contacts.values())
        .find(c => c.name === 'trigger' && c.boundaryDirection === 'input')
      const successOutput = Array.from(state.contacts.values())
        .find(c => c.name === 'success' && c.boundaryDirection === 'output')
      
      // Spit to file
      await runtime.scheduleUpdate(destinationInput!.id, testFile)
      await runtime.scheduleUpdate(contentInput!.id, testData)
      await runtime.scheduleUpdate(triggerInput!.id, true)
      
      // Wait for propagation
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check success
      const result = await runtime.getState(spitGadgetId)
      const success = result.contacts.get(successOutput!.id)?.content
      expect(success).toBe(true)
      
      // Verify JSON was written correctly
      const actualContent = await fs.readFile(testFile, 'utf-8')
      const parsedContent = JSON.parse(actualContent)
      expect(parsedContent).toEqual(testData)
    })
  })
})