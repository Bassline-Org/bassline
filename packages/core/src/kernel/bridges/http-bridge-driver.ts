/**
 * HTTP Bridge Driver for Kernel
 * 
 * Provides REST API integration with polling support
 * Includes retry logic, circuit breaker, and batch operations
 */

import { AbstractBridgeDriver } from '../bridge-driver'
import type {
  ContactChange,
  ExternalInput,
  DriverCommand,
  CommandResponse,
} from '../types'
import { DriverError } from '../types'
import { brand } from '../../types'
import type { ContactId, GroupId } from '../../types'

export interface HTTPBridgeConfig {
  baseUrl: string
  pollInterval?: number           // ms between polls (0 = no polling)
  longPollTimeout?: number        // ms for long polling requests
  headers?: Record<string, string>
  retryAttempts?: number
  retryDelay?: number
  circuitBreakerThreshold?: number // failures before circuit opens
  circuitBreakerResetTime?: number // ms before trying again
  batchSize?: number              // max changes to send in one request
  batchDelay?: number             // ms to wait before sending batch
  id?: string
}

export interface HTTPRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  headers?: Record<string, string>
  body?: any
}

export interface HTTPResponse {
  status: number
  headers: Record<string, string>
  body: any
}

interface BatchedChange {
  change: ContactChange
  timestamp: number
}

enum CircuitState {
  CLOSED = 'closed',  // Normal operation
  OPEN = 'open',      // Failing, reject all requests
  HALF_OPEN = 'half-open' // Testing if service recovered
}

export class HTTPBridgeDriver extends AbstractBridgeDriver {
  private config: Required<HTTPBridgeConfig>
  private pollTimer?: NodeJS.Timeout
  private batchTimer?: NodeJS.Timeout
  private batchedChanges: BatchedChange[] = []
  private lastPollTime?: Date
  private lastSequenceId?: string
  
  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED
  private consecutiveFailures = 0
  private circuitOpenedAt?: Date
  private circuitTestTimer?: NodeJS.Timeout
  
  // Retry state
  private retryQueues = new Map<string, { request: HTTPRequest; attempts: number }>()
  
  constructor(config: HTTPBridgeConfig) {
    super({
      id: config.id,
      name: 'http-bridge',
      version: '1.0.0'
    })
    
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      pollInterval: config.pollInterval ?? 5000,
      longPollTimeout: config.longPollTimeout ?? 30000,
      headers: config.headers ?? {},
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerResetTime: config.circuitBreakerResetTime ?? 60000,
      batchSize: config.batchSize ?? 100,
      batchDelay: config.batchDelay ?? 100,
      id: config.id || 'http-bridge'
    }
  }
  
  // ============================================================================
  // AbstractBridgeDriver Implementation
  // ============================================================================
  
  protected async onStartListening(): Promise<void> {
    // Start polling if configured
    if (this.config.pollInterval > 0) {
      this.startPolling()
    }
  }
  
  protected async onStopListening(): Promise<void> {
    this.stopPolling()
    this.stopBatchTimer()
    
    // Flush any remaining batched changes
    if (this.batchedChanges.length > 0) {
      await this.flushBatch()
    }
    
    // Clear circuit breaker timer
    if (this.circuitTestTimer) {
      clearTimeout(this.circuitTestTimer)
      this.circuitTestTimer = undefined
    }
  }
  
  protected async onHandleChange(change: ContactChange): Promise<void> {
    // Add to batch
    this.batchedChanges.push({
      change,
      timestamp: Date.now()
    })
    
    this.updateQueueLength(this.batchedChanges.length)
    
    // Send immediately if batch is full
    if (this.batchedChanges.length >= this.config.batchSize) {
      await this.flushBatch()
    } else {
      // Otherwise schedule batch send
      this.scheduleBatch()
    }
  }
  
  protected async onInitialize(): Promise<void> {
    // Test connection
    try {
      await this.makeRequest({
        method: 'GET',
        path: '/health'
      })
    } catch (error) {
      // Health check is optional, don't fail initialization
      console.warn('HTTP Bridge health check failed:', error)
    }
  }
  
  protected async onShutdown(force: boolean): Promise<void> {
    if (!force) {
      // Try to flush pending changes
      await this.flushBatch()
    } else {
      // Clear everything
      this.batchedChanges = []
      this.retryQueues.clear()
    }
  }
  
  protected async onHealthCheck(): Promise<boolean> {
    // Check circuit breaker state
    if (this.circuitState === CircuitState.OPEN) {
      return false
    }
    
    // Try a health check request
    try {
      const response = await this.makeRequest({
        method: 'GET',
        path: '/health'
      })
      return response.status === 200
    } catch {
      return false
    }
  }
  
  protected async onHandleCommand(command: DriverCommand): Promise<CommandResponse> {
    switch ((command as any).type) {
      case 'force-poll':
        await this.poll()
        return { status: 'success' }
        
      case 'flush-batch':
        await this.flushBatch()
        return { status: 'success' }
        
      case 'reset-circuit':
        this.resetCircuitBreaker()
        return { status: 'success' }
        
      case 'get-circuit-state':
        return { 
          status: 'success', 
          data: { 
            state: this.circuitState,
            failures: this.consecutiveFailures
          } 
        }
        
      default:
        throw new DriverError(
          `Unknown command: ${(command as any).type}`,
          { fatal: false }
        )
    }
  }
  
  // ============================================================================
  // HTTP Request Management
  // ============================================================================
  
  private async makeRequest(request: HTTPRequest): Promise<HTTPResponse> {
    // Check circuit breaker
    if (this.circuitState === CircuitState.OPEN) {
      throw new DriverError(
        'Circuit breaker is open - service unavailable',
        { fatal: false }
      )
    }
    
    const url = `${this.config.baseUrl}${request.path}`
    const headers = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...request.headers
    }
    
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.longPollTimeout)
      
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal
      })
      
      clearTimeout(timeout)
      
      const body = await response.json().catch(() => null)
      
      const httpResponse: HTTPResponse = {
        status: response.status,
        headers: Object.fromEntries(response.headers as any),
        body
      }
      
      // Reset circuit breaker on success
      if (response.ok) {
        this.onRequestSuccess()
      } else {
        this.onRequestFailure()
      }
      
      return httpResponse
    } catch (error: any) {
      this.onRequestFailure()
      
      // Check if we should retry
      const requestKey = `${request.method}:${request.path}`
      const retryInfo = this.retryQueues.get(requestKey)
      
      if (!retryInfo || retryInfo.attempts < this.config.retryAttempts) {
        // Schedule retry
        this.scheduleRetry(request, retryInfo?.attempts ?? 0)
      }
      
      throw new DriverError(
        `HTTP request failed: ${error.message}`,
        { fatal: false, originalError: error }
      )
    }
  }
  
  private scheduleRetry(request: HTTPRequest, previousAttempts: number): void {
    const attempts = previousAttempts + 1
    const delay = this.config.retryDelay * Math.pow(2, attempts - 1) // Exponential backoff
    const requestKey = `${request.method}:${request.path}`
    
    this.retryQueues.set(requestKey, { request, attempts })
    
    setTimeout(async () => {
      this.retryQueues.delete(requestKey)
      try {
        await this.makeRequest(request)
      } catch (error) {
        // Retry failed, already scheduled another retry if applicable
      }
    }, delay)
  }
  
  // ============================================================================
  // Circuit Breaker
  // ============================================================================
  
  private onRequestSuccess(): void {
    this.consecutiveFailures = 0
    
    if (this.circuitState === CircuitState.HALF_OPEN) {
      // Test succeeded, close circuit
      this.circuitState = CircuitState.CLOSED
      this.emit('circuit-closed')
    }
  }
  
  private onRequestFailure(): void {
    this.consecutiveFailures++
    
    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuit()
    }
  }
  
  private openCircuit(): void {
    if (this.circuitState === CircuitState.OPEN) return
    
    this.circuitState = CircuitState.OPEN
    this.circuitOpenedAt = new Date()
    this.emit('circuit-opened', { failures: this.consecutiveFailures })
    
    // Schedule half-open test
    this.circuitTestTimer = setTimeout(() => {
      this.circuitState = CircuitState.HALF_OPEN
      this.emit('circuit-half-open')
    }, this.config.circuitBreakerResetTime)
  }
  
  private resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED
    this.consecutiveFailures = 0
    this.circuitOpenedAt = undefined
    
    if (this.circuitTestTimer) {
      clearTimeout(this.circuitTestTimer)
      this.circuitTestTimer = undefined
    }
  }
  
  // ============================================================================
  // Polling
  // ============================================================================
  
  private startPolling(): void {
    if (this.pollTimer) return
    
    const doPoll = async () => {
      try {
        await this.poll()
      } catch (error) {
        if (this.listenerCount('error') > 0) {
          this.emit('error', { error: 'Poll failed', details: error })
        }
      }
      
      // Schedule next poll
      this.pollTimer = setTimeout(doPoll, this.config.pollInterval)
    }
    
    // Start polling
    this.pollTimer = setTimeout(doPoll, this.config.pollInterval)
  }
  
  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = undefined
    }
  }
  
  private async poll(): Promise<void> {
    if (this.circuitState === CircuitState.OPEN) return
    
    try {
      // Long polling request
      const response = await this.makeRequest({
        method: 'GET',
        path: '/poll',
        headers: {
          'X-Last-Sequence-Id': this.lastSequenceId || '',
          'X-Long-Poll-Timeout': String(this.config.longPollTimeout)
        }
      })
      
      if (response.status === 200 && response.body) {
        this.lastPollTime = new Date()
        
        // Process updates
        if (Array.isArray(response.body.updates)) {
          for (const update of response.body.updates) {
            await this.processUpdate(update)
          }
        }
        
        // Update sequence ID for next poll
        if (response.body.sequenceId) {
          this.lastSequenceId = response.body.sequenceId
        }
      }
    } catch (error) {
      // Error already handled by makeRequest
    }
  }
  
  private async processUpdate(update: any): Promise<void> {
    if (!this.inputHandler) return
    
    // Convert HTTP update to external input
    const input: ExternalInput = {
      type: 'external-input',
      source: 'http',
      contactId: brand.contactId(update.contactId),
      groupId: brand.groupId(update.groupId),
      value: update.value,
      metadata: {
        timestamp: update.timestamp || Date.now(),
        sequenceId: update.sequenceId
      }
    }
    
    await this.sendInput(input)
  }
  
  // ============================================================================
  // Batching
  // ============================================================================
  
  private scheduleBatch(): void {
    if (this.batchTimer) return
    
    this.batchTimer = setTimeout(() => {
      this.batchTimer = undefined
      this.flushBatch()
    }, this.config.batchDelay)
  }
  
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = undefined
    }
  }
  
  private async flushBatch(): Promise<void> {
    if (this.batchedChanges.length === 0) return
    
    const batch = [...this.batchedChanges]
    this.batchedChanges = []
    this.updateQueueLength(0)
    this.stopBatchTimer()
    
    try {
      await this.makeRequest({
        method: 'POST',
        path: '/batch',
        body: {
          changes: batch.map(b => ({
            ...b.change,
            timestamp: b.timestamp
          }))
        }
      })
      
      this.stats.processed += batch.length
    } catch (error) {
      // Re-queue failed batch (at the front)
      this.batchedChanges.unshift(...batch)
      this.updateQueueLength(this.batchedChanges.length)
      throw error
    }
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  getCircuitState(): CircuitState {
    return this.circuitState
  }
  
  getLastPollTime(): Date | undefined {
    return this.lastPollTime
  }
  
  getBatchSize(): number {
    return this.batchedChanges.length
  }
  
  async forceFlush(): Promise<void> {
    await this.flushBatch()
  }
}