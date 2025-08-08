/**
 * Tests for HTTPBridgeDriver
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HTTPBridgeDriver } from '../bridges/http-bridge-driver'
import { Kernel } from '../kernel'
import { UserspaceRuntime } from '../userspace-runtime'
import { MemoryStorageDriver } from '../drivers/memory-storage-driver'
import type { ExternalInput } from '../types'
import { brand } from '../../types'
import http from 'http'
import express from 'express'

// Mock HTTP server for testing
class MockHTTPServer {
  private server?: http.Server
  private app: express.Application
  private port: number
  
  // Track requests for testing
  private requests: any[] = []
  private responses: Map<string, any> = new Map()
  private errorResponses: Map<string, { status: number, error: string }> = new Map()
  private requestDelays: Map<string, number> = new Map()
  
  // Polling state
  private updates: any[] = []
  private sequenceId = 0
  
  constructor(port: number = 8080) {
    this.port = port
    this.app = express()
    this.setupRoutes()
  }
  
  private setupRoutes(): void {
    this.app.use(express.json())
    
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      await this.delay('/health')
      
      const error = this.errorResponses.get('/health')
      if (error) {
        res.status(error.status).json({ error: error.error })
        return
      }
      
      res.json({ status: 'healthy' })
    })
    
    // Polling endpoint with long polling support
    this.app.get('/poll', async (req, res) => {
      const lastSequenceId = req.headers['x-last-sequence-id']
      const longPollTimeout = parseInt(req.headers['x-long-poll-timeout'] as string || '0')
      
      await this.delay('/poll')
      
      const error = this.errorResponses.get('/poll')
      if (error) {
        res.status(error.status).json({ error: error.error })
        return
      }
      
      // Filter updates since last sequence ID
      const newUpdates = this.updates.filter(u => 
        !lastSequenceId || u.sequenceId > parseInt(lastSequenceId as string)
      )
      
      if (newUpdates.length > 0 || longPollTimeout === 0) {
        // Return immediately if we have updates or not long polling
        res.json({
          updates: newUpdates,
          sequenceId: this.sequenceId
        })
      } else {
        // Long polling - wait for updates or timeout
        const startTime = Date.now()
        const checkInterval = 100
        
        const waitForUpdates = async (): Promise<void> => {
          if (Date.now() - startTime >= longPollTimeout) {
            // Timeout - return empty
            res.json({
              updates: [],
              sequenceId: this.sequenceId
            })
            return
          }
          
          const newUpdates = this.updates.filter(u => 
            !lastSequenceId || u.sequenceId > parseInt(lastSequenceId as string)
          )
          
          if (newUpdates.length > 0) {
            res.json({
              updates: newUpdates,
              sequenceId: this.sequenceId
            })
          } else {
            setTimeout(waitForUpdates, checkInterval)
          }
        }
        
        await waitForUpdates()
      }
    })
    
    // Batch endpoint for receiving changes
    this.app.post('/batch', async (req, res) => {
      this.requests.push({ path: '/batch', body: req.body })
      
      await this.delay('/batch')
      
      const error = this.errorResponses.get('/batch')
      if (error) {
        res.status(error.status).json({ error: error.error })
        return
      }
      
      const response = this.responses.get('/batch')
      if (response) {
        res.json(response)
      } else {
        res.json({ status: 'accepted', count: req.body.changes?.length || 0 })
      }
    })
    
    // Generic catch-all for other endpoints - using middleware function
    this.app.use(async (req, res) => {
      this.requests.push({ 
        path: req.path, 
        method: req.method,
        headers: req.headers,
        body: req.body 
      })
      
      await this.delay(req.path)
      
      const error = this.errorResponses.get(req.path)
      if (error) {
        res.status(error.status).json({ error: error.error })
        return
      }
      
      const response = this.responses.get(req.path)
      if (response) {
        res.json(response)
      } else {
        res.status(404).json({ error: 'Not found' })
      }
    })
  }
  
  private async delay(path: string): Promise<void> {
    const delay = this.requestDelays.get(path)
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        resolve()
      })
    })
  }
  
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => resolve())
      })
    }
  }
  
  // Test helpers
  getRequests(path?: string): any[] {
    if (path) {
      return this.requests.filter(r => r.path === path)
    }
    return this.requests
  }
  
  clearRequests(): void {
    this.requests = []
  }
  
  setResponse(path: string, response: any): void {
    this.responses.set(path, response)
  }
  
  setError(path: string, status: number, error: string): void {
    this.errorResponses.set(path, { status, error })
  }
  
  clearErrors(): void {
    this.errorResponses.clear()
  }
  
  setDelay(path: string, delay: number): void {
    this.requestDelays.set(path, delay)
  }
  
  // Polling helpers
  addUpdate(update: any): void {
    this.sequenceId++
    this.updates.push({
      ...update,
      sequenceId: this.sequenceId
    })
  }
  
  clearUpdates(): void {
    this.updates = []
  }
  
  getSequenceId(): number {
    return this.sequenceId
  }
}

describe('HTTPBridgeDriver', () => {
  let mockServer: MockHTTPServer
  let bridge: HTTPBridgeDriver
  
  beforeEach(async () => {
    // Start mock HTTP server
    mockServer = new MockHTTPServer(8080)
    await mockServer.start()
  })
  
  afterEach(async () => {
    // Clean up
    if (bridge) {
      try {
        await bridge.stopListening()
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    await mockServer.stop()
  })
  
  describe('Core Functionality', () => {
    describe('Connection Management', () => {
      it('should connect to HTTP server and perform health check', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0  // Disable polling for this test
        })
        
        // Add error handler to prevent unhandled errors
        bridge.on('error', () => {
          // Ignore errors in test
        })
        
        await bridge.startListening()
        
        const healthRequests = mockServer.getRequests('/health')
        expect(healthRequests.length).toBeGreaterThan(0)
        expect(await bridge.isHealthy()).toBe(true)
      })
      
      it('should handle connection failure gracefully', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:9999', // Non-existent server
          pollInterval: 0
        })
        
        // Add error handler to prevent unhandled errors
        bridge.on('error', () => {
          // Expected error, ignore
        })
        
        // Start listening might fail but shouldn't throw
        await bridge.startListening()
        
        expect(await bridge.isHealthy()).toBe(false)
      })
      
      it('should handle server errors gracefully', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          retryAttempts: 1
        })
        
        // Make health check fail
        mockServer.setError('/health', 500, 'Internal server error')
        
        await bridge.startListening()
        
        expect(await bridge.isHealthy()).toBe(false)
      })
    })
    
    describe('Batch Operations', () => {
      it('should batch multiple changes together', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          batchSize: 5,
          batchDelay: 100
        })
        
        await bridge.startListening()
        
        // Send multiple changes quickly
        for (let i = 0; i < 3; i++) {
          await bridge.handleChange({
            contactId: brand.contactId(`test-${i}`),
            groupId: brand.groupId('test-group'),
            value: i
          })
        }
        
        // Wait for batch to be sent
        await new Promise(resolve => setTimeout(resolve, 150))
        
        const batchRequests = mockServer.getRequests('/batch')
        expect(batchRequests.length).toBe(1)
        expect(batchRequests[0].body.changes).toHaveLength(3)
      })
      
      it('should flush batch when full', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          batchSize: 3,
          batchDelay: 1000  // Long delay
        })
        
        await bridge.startListening()
        
        // Send exactly batchSize changes
        for (let i = 0; i < 3; i++) {
          await bridge.handleChange({
            contactId: brand.contactId(`test-${i}`),
            groupId: brand.groupId('test-group'),
            value: i
          })
        }
        
        // Should flush immediately without waiting for delay
        await new Promise(resolve => setTimeout(resolve, 50))
        
        const batchRequests = mockServer.getRequests('/batch')
        expect(batchRequests.length).toBe(1)
        expect(batchRequests[0].body.changes).toHaveLength(3)
      })
      
      it('should handle batch failures with retry', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          batchSize: 10,
          batchDelay: 50,
          retryAttempts: 2,
          retryDelay: 100
        })
        
        await bridge.startListening()
        
        // Make first batch fail, then succeed
        mockServer.setError('/batch', 500, 'Server error')
        
        await bridge.handleChange({
          contactId: brand.contactId('test'),
          groupId: brand.groupId('test-group'),
          value: 'test'
        })
        
        // Wait for initial attempt
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Clear error for retry
        mockServer.clearErrors()
        
        // Wait for retry
        await new Promise(resolve => setTimeout(resolve, 200))
        
        const batchRequests = mockServer.getRequests('/batch')
        expect(batchRequests.length).toBeGreaterThanOrEqual(2) // Initial + retry
      })
    })
    
    describe('Polling', () => {
      it('should poll for updates at configured interval', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 100,
          longPollTimeout: 0  // Disable long polling
        })
        
        await bridge.startListening()
        
        // Wait for multiple poll cycles
        await new Promise(resolve => setTimeout(resolve, 250))
        
        const pollRequests = mockServer.getRequests('/poll')
        expect(pollRequests.length).toBeGreaterThanOrEqual(2)
      })
      
      it('should process updates from polling', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 100,
          longPollTimeout: 0
        })
        
        const inputHandler = vi.fn()
        bridge.setInputHandler(inputHandler)
        
        // Add an update to the server
        mockServer.addUpdate({
          contactId: 'test-contact',
          groupId: 'test-group',
          value: 'test-value',
          timestamp: Date.now()
        })
        
        await bridge.startListening()
        
        // Wait for poll to happen
        await new Promise(resolve => setTimeout(resolve, 150))
        
        expect(inputHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'external-input',
            source: 'http',
            contactId: brand.contactId('test-contact'),
            groupId: brand.groupId('test-group'),
            value: 'test-value'
          })
        )
      })
      
      it('should track sequence IDs to avoid duplicate processing', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 100,
          longPollTimeout: 0
        })
        
        const inputHandler = vi.fn()
        bridge.setInputHandler(inputHandler)
        
        // Add an update
        mockServer.addUpdate({
          contactId: 'test-1',
          groupId: 'test-group',
          value: 'value-1'
        })
        
        await bridge.startListening()
        
        // Wait for first poll
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Should have processed the update once
        expect(inputHandler).toHaveBeenCalledTimes(1)
        
        // Wait for second poll
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Should still only have processed once (same update)
        expect(inputHandler).toHaveBeenCalledTimes(1)
        
        // Add new update
        mockServer.addUpdate({
          contactId: 'test-2',
          groupId: 'test-group',
          value: 'value-2'
        })
        
        // Wait for next poll
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Now should have processed twice
        expect(inputHandler).toHaveBeenCalledTimes(2)
      })
    })
    
    describe('Circuit Breaker', () => {
      it('should open circuit after threshold failures', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          circuitBreakerThreshold: 3,
          circuitBreakerResetTime: 1000,
          retryAttempts: 0  // Disable retries for this test
        })
        
        const circuitOpenedPromise = new Promise(resolve => {
          bridge.once('circuit-opened', resolve)
        })
        
        await bridge.startListening()
        
        // Make server fail consistently
        mockServer.setError('/batch', 500, 'Server error')
        
        // Send multiple changes to trigger failures
        for (let i = 0; i < 3; i++) {
          try {
            await bridge.handleChange({
              contactId: brand.contactId(`test-${i}`),
              groupId: brand.groupId('test-group'),
              value: i
            })
            await bridge.forceFlush()
          } catch (error) {
            // Expected failures
          }
        }
        
        await circuitOpenedPromise
        
        expect(bridge.getCircuitState()).toBe('open')
        
        // Further requests should fail immediately
        const startTime = Date.now()
        try {
          await bridge.handleChange({
            contactId: brand.contactId('test-final'),
            groupId: brand.groupId('test-group'),
            value: 'final'
          })
          await bridge.forceFlush()
        } catch (error: any) {
          expect(error.message).toContain('Circuit breaker is open')
        }
        const elapsed = Date.now() - startTime
        expect(elapsed).toBeLessThan(50) // Should fail fast
      })
      
      it('should reset circuit after timeout', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          circuitBreakerThreshold: 2,
          circuitBreakerResetTime: 200,
          retryAttempts: 0
        })
        
        await bridge.startListening()
        
        // Open the circuit
        mockServer.setError('/batch', 500, 'Server error')
        
        for (let i = 0; i < 2; i++) {
          try {
            await bridge.handleChange({
              contactId: brand.contactId(`test-${i}`),
              groupId: brand.groupId('test-group'),
              value: i
            })
            await bridge.forceFlush()
          } catch (error) {
            // Expected
          }
        }
        
        expect(bridge.getCircuitState()).toBe('open')
        
        // Clear errors and wait for reset
        mockServer.clearErrors()
        
        const halfOpenPromise = new Promise(resolve => {
          bridge.once('circuit-half-open', resolve)
        })
        
        await halfOpenPromise
        
        expect(bridge.getCircuitState()).toBe('half-open')
        
        // Next successful request should close circuit
        await bridge.handleChange({
          contactId: brand.contactId('test-recovery'),
          groupId: brand.groupId('test-group'),
          value: 'recovery'
        })
        await bridge.forceFlush()
        
        expect(bridge.getCircuitState()).toBe('closed')
      })
    })
    
    describe('Commands', () => {
      it('should handle force-poll command', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0  // No automatic polling
        })
        
        await bridge.startListening()
        
        // No polls yet
        expect(mockServer.getRequests('/poll')).toHaveLength(0)
        
        // Force a poll
        const response = await bridge.handleCommand({ type: 'force-poll' } as any)
        expect(response.status).toBe('success')
        
        // Should have polled
        expect(mockServer.getRequests('/poll')).toHaveLength(1)
      })
      
      it('should handle flush-batch command', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          batchDelay: 10000  // Very long delay
        })
        
        await bridge.startListening()
        
        // Add a change but don't wait for batch
        await bridge.handleChange({
          contactId: brand.contactId('test'),
          groupId: brand.groupId('test-group'),
          value: 'test'
        })
        
        // Force flush
        const response = await bridge.handleCommand({ type: 'flush-batch' } as any)
        expect(response.status).toBe('success')
        
        // Should have sent batch immediately
        expect(mockServer.getRequests('/batch')).toHaveLength(1)
      })
      
      it('should handle reset-circuit command', async () => {
        bridge = new HTTPBridgeDriver({
          baseUrl: 'http://localhost:8080',
          pollInterval: 0,
          circuitBreakerThreshold: 1
        })
        
        await bridge.startListening()
        
        // Open the circuit
        mockServer.setError('/batch', 500, 'Error')
        try {
          await bridge.handleChange({
            contactId: brand.contactId('test'),
            groupId: brand.groupId('test-group'),
            value: 'test'
          })
          await bridge.forceFlush()
        } catch (error) {
          // Expected
        }
        
        expect(bridge.getCircuitState()).toBe('open')
        
        // Reset circuit
        const response = await bridge.handleCommand({ type: 'reset-circuit' } as any)
        expect(response.status).toBe('success')
        
        expect(bridge.getCircuitState()).toBe('closed')
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
      
      // Initialize storage
      await storage.initialize()
      
      // Register storage driver with kernel
      kernel.registerDriver(storage)
      
      // Create runtime with kernel
      runtime = new UserspaceRuntime({ 
        kernel
      })
      
      // Connect runtime to kernel for external input
      kernel.setUserspaceHandler(runtime.receiveExternalInput.bind(runtime))
    })
    
    afterEach(async () => {
      await kernel.shutdown()
    })
    
    it('should propagate changes through kernel to HTTP endpoint', async () => {
      // Create and register bridge
      bridge = new HTTPBridgeDriver({
        baseUrl: 'http://localhost:8080',
        pollInterval: 0,
        batchDelay: 50
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
        content: 'initial-value',
        blendMode: 'accept-last'
      })
      
      // Update contact - should propagate through kernel to bridge
      await runtime.scheduleUpdate(contactId, 'updated-value')
      
      // Wait for batch to be sent
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check that HTTP endpoint received the change
      const batchRequests = mockServer.getRequests('/batch')
      expect(batchRequests.length).toBe(1)
      expect(batchRequests[0].body.changes).toContainEqual(
        expect.objectContaining({
          contactId,
          groupId,
          value: 'updated-value'
        })
      )
    })
    
    it('should receive external input through HTTP polling and update runtime', async () => {
      // Create and register bridge
      bridge = new HTTPBridgeDriver({
        baseUrl: 'http://localhost:8080',
        pollInterval: 100,
        longPollTimeout: 0
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      // Create contact in runtime
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
        content: 'initial-value',
        blendMode: 'accept-last'
      })
      
      // Add external update to server
      mockServer.addUpdate({
        contactId,
        groupId,
        value: 'external-value',
        timestamp: Date.now()
      })
      
      // Wait for polling to pick it up
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Check that runtime was updated
      const state = await runtime.getState(groupId)
      const contact = state.contacts.get(contactId)
      expect(contact?.content).toBe('external-value')
    })
    
    it('should handle network failures gracefully', async () => {
      // Create bridge with circuit breaker
      bridge = new HTTPBridgeDriver({
        baseUrl: 'http://localhost:8080',
        pollInterval: 0,
        circuitBreakerThreshold: 2,
        circuitBreakerResetTime: 500,
        retryAttempts: 1,
        retryDelay: 50
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      // Create contact
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
        content: 'value-1',
        blendMode: 'accept-last'
      })
      
      // Make server fail
      mockServer.setError('/batch', 500, 'Server error')
      
      // Try to update - should fail but not crash
      await runtime.scheduleUpdate(contactId, 'value-2')
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Bridge should still be healthy (or not, depending on circuit state)
      // The important thing is it didn't crash
      const isHealthy = await bridge.isHealthy()
      expect(typeof isHealthy).toBe('boolean')
      
      // Clear errors
      mockServer.clearErrors()
      
      // Wait for circuit to reset
      await new Promise(resolve => setTimeout(resolve, 600))
      
      // Should be able to send updates again
      await runtime.scheduleUpdate(contactId, 'value-3')
      await bridge.forceFlush()
      
      const batchRequests = mockServer.getRequests('/batch')
      const lastRequest = batchRequests[batchRequests.length - 1]
      expect(lastRequest.body.changes).toContainEqual(
        expect.objectContaining({
          contactId,
          value: 'value-3'
        })
      )
    })
  })
})