/**
 * Kernel implementation
 * The stateless kernel that routes changes between userspace and drivers
 */

import type {
  ContactChange,
  ExternalInput,
  KernelResponse,
  DriverCommand,
  InitializeCommand,
  ShutdownCommand,
  HealthCheckCommand,
} from './types'
import { KernelError, DriverError, CommandError } from './types'
import type { Driver, BridgeDriver, StorageDriver } from './driver'
import { PrimitiveLoaderDriver } from './drivers/primitive-loader-driver'
import { SchedulerDriver } from './drivers/scheduler-driver'
import { UserspaceRuntime } from './userspace-runtime'

/**
 * KernelBassline - The manifest/blueprint for a kernel
 * This describes how the kernel should behave
 */
export interface KernelBassline {
  /**
   * Whether to fail fast on driver errors
   * If true, one driver failure stops all processing
   * If false, continues with other drivers
   */
  failFast?: boolean
  
  /**
   * Enable debug logging
   */
  debug?: boolean
  
  /**
   * Optional list of driver manifests to initialize with
   * (Future: these would be DriverBasslines)
   */
  drivers?: Array<{
    type: string
    config?: unknown
  }>
}

/**
 * Kernel - The stateless kernel runtime
 * 
 * Responsibilities:
 * - Route changes from userspace to all drivers
 * - Route external input from drivers to userspace
 * - Manage driver lifecycle
 * - Ensure NO silent failures
 * 
 * Note: KernelBassline would be the configuration manifest,
 * this is the actual runtime instance
 */
export class Kernel {
  private readonly drivers = new Map<string, Driver>()
  private readonly bridgeDrivers = new Set<string>()
  private readonly storageDrivers = new Set<string>()
  private userspaceHandler?: (input: ExternalInput) => Promise<void>
  private readonly bassline: KernelBassline
  private readonly pendingOperations = new Set<Promise<void>>()
  
  // New: Core system drivers
  private primitiveLoader?: PrimitiveLoaderDriver
  private schedulerDriver?: SchedulerDriver
  private runtime?: UserspaceRuntime
  
  constructor(bassline: KernelBassline = {}) {
    // Store the bassline with defaults
    this.bassline = {
      failFast: bassline.failFast ?? false,
      debug: bassline.debug ?? false,
      drivers: bassline.drivers ?? []
    }
  }
  
  /**
   * Get the kernel's bassline (manifest)
   */
  getBassline(): Readonly<KernelBassline> {
    return this.bassline
  }
  
  /**
   * Register a driver with the kernel
   * @throws {KernelError} If driver is already registered
   */
  async registerDriver(driver: Driver): Promise<void> {
    if (this.drivers.has(driver.id)) {
      throw new KernelError(`Driver ${driver.id} is already registered`)
    }
    
    // Initialize the driver
    try {
      await driver.handleCommand({
        type: 'initialize',
        config: undefined
      } satisfies InitializeCommand)
    } catch (error) {
      if (error instanceof CommandError) {
        throw new KernelError(`Failed to initialize driver ${driver.id}: ${error.message}`, { cause: error })
      }
      throw error
    }
    
    // Register based on type
    this.drivers.set(driver.id, driver)
    
    // Check if it's a bridge driver
    if (this.isBridgeDriver(driver)) {
      this.bridgeDrivers.add(driver.id)
      driver.setInputHandler(async (input) => {
        await this.handleExternalInput(input)
      })
      await driver.startListening()
    }
    
    // Check if it's a storage driver
    if (this.isStorageDriver(driver)) {
      this.storageDrivers.add(driver.id)
    }
    
    this.log(`Registered driver: ${driver.id} (${driver.name} v${driver.version})`)
  }
  
  /**
   * Unregister a driver
   * @throws {KernelError} If driver is not registered
   */
  async unregisterDriver(driverId: string): Promise<void> {
    const driver = this.drivers.get(driverId)
    if (!driver) {
      throw new KernelError(`Driver ${driverId} is not registered`)
    }
    
    // Stop bridge drivers
    if (this.bridgeDrivers.has(driverId)) {
      const bridgeDriver = driver as BridgeDriver
      await bridgeDriver.stopListening()
      this.bridgeDrivers.delete(driverId)
    }
    
    // Shutdown the driver
    try {
      await driver.handleCommand({
        type: 'shutdown',
        force: false
      } satisfies ShutdownCommand)
    } catch (error) {
      if (error instanceof CommandError && !error.canContinue) {
        // Force shutdown if graceful fails
        await driver.handleCommand({
          type: 'shutdown',
          force: true
        } satisfies ShutdownCommand)
      }
    }
    
    this.drivers.delete(driverId)
    this.storageDrivers.delete(driverId)
    
    this.log(`Unregistered driver: ${driverId}`)
  }
  
  /**
   * Set the userspace handler for external input
   */
  setUserspaceHandler(handler: (input: ExternalInput) => Promise<void>): void {
    this.userspaceHandler = handler
  }
  
  /**
   * Set the userspace runtime (for new modular system)
   */
  setUserspaceRuntime(runtime: UserspaceRuntime): void {
    this.runtime = runtime
    // Also set the handler for backwards compatibility
    this.setUserspaceHandler(runtime.receiveExternalInput.bind(runtime))
    
    // If system drivers are already initialized, pass them to the runtime
    if (this.primitiveLoader) {
      runtime.setPrimitiveLoader(this.primitiveLoader)
    }
    if (this.schedulerDriver) {
      runtime.setSchedulerDriver(this.schedulerDriver)
    }
  }
  
  /**
   * Initialize core system drivers
   */
  async initializeSystemDrivers(): Promise<void> {
    // Initialize primitive loader
    this.primitiveLoader = new PrimitiveLoaderDriver()
    await this.primitiveLoader.initialize()
    
    // Load core primitives
    await this.primitiveLoader.loadModule({
      type: 'builtin',
      module: () => import('../primitives/core-module'),
      namespace: '@bassline/core'
    })
    
    // TODO: Load additional primitive modules
    // The impure gadgets (slurp, spit) have Node.js dependencies and can't run in browser
    // Need to either:
    // 1. Create browser-compatible versions
    // 2. Run them server-side only
    // 3. Use conditional loading based on environment
    
    // Initialize scheduler driver
    this.schedulerDriver = new SchedulerDriver()
    await this.schedulerDriver.initialize()
    
    // Load core schedulers
    const schedulerModule = await import('../scheduler/core-module')
    for (const [name, factory] of Object.entries(schedulerModule)) {
      if (typeof factory === 'function') {
        // Register each scheduler factory
        this.schedulerDriver.registerScheduler(name, factory as () => any)
      }
    }
    
    // Wire to runtime if available
    if (this.runtime) {
      this.runtime.setPrimitiveLoader(this.primitiveLoader)
      this.runtime.setSchedulerDriver(this.schedulerDriver)
    }
    
    // Set default scheduler
    this.schedulerDriver.activateScheduler('immediate')
    
    if (this.bassline.debug) {
      console.log('[Kernel] System drivers initialized')
      console.log('[Kernel] Loaded primitives:', this.primitiveLoader.listPrimitives())
      console.log('[Kernel] Available schedulers:', this.schedulerDriver.listSchedulers())
    }
  }
  
  /**
   * Get the primitive loader driver
   */
  getPrimitiveLoader(): PrimitiveLoaderDriver | undefined {
    return this.primitiveLoader
  }
  
  /**
   * Get the scheduler driver
   */
  getSchedulerDriver(): SchedulerDriver | undefined {
    return this.schedulerDriver
  }
  
  /**
   * Handle a change from userspace
   * Routes to all registered drivers
   * Returns immediately while processing happens asynchronously
   * 
   * @throws {KernelError} If failFast is true and any driver fails
   */
  async handleChange(change: ContactChange): Promise<void> {
    console.log('[Kernel] handleChange called:', {
      contactId: change.contactId,
      value: change.value,
      driverCount: this.drivers.size,
      storageDriverCount: this.storageDrivers.size
    })
    
    // Create promise for this operation
    const promise = this.processChange(change)
      .finally(() => {
        this.pendingOperations.delete(promise)
      })
    
    this.pendingOperations.add(promise)
    
    // Don't await - return immediately to avoid blocking userspace
    return
  }
  
  /**
   * Actually process the change (internal method)
   */
  private async processChange(change: ContactChange): Promise<void> {
    const errors: Array<{ driverId: string; error: DriverError }> = []
    
    // Check preconditions for storage drivers
    for (const driverId of this.storageDrivers) {
      const driver = this.drivers.get(driverId) as StorageDriver
      if (driver?.checkPreconditions) {
        try {
          await driver.checkPreconditions(change)
        } catch (error) {
          if (error instanceof DriverError && error.fatal) {
            throw new KernelError(
              `Precondition check failed for driver ${driverId}: ${error.message}`,
              { cause: error }
            )
          }
          // Non-fatal precondition failures are logged but don't stop processing
          this.log(`Precondition check failed for driver ${driverId}`, error)
        }
      }
    }
    
    // Process the change through all drivers
    for (const [driverId, driver] of this.drivers) {
      try {
        await driver.handleChange(change)
      } catch (error) {
        if (error instanceof DriverError) {
          errors.push({ driverId, error })
          
          if (error.fatal || this.bassline.failFast) {
            throw new KernelError(
              `Fatal error in driver ${driverId}: ${error.message}`,
              { cause: error }
            )
          }
        } else {
          // Unexpected error - always fatal
          throw new KernelError(
            `Unexpected error in driver ${driverId}`,
            { cause: error }
          )
        }
      }
    }
    
    // Check postconditions for storage drivers
    for (const driverId of this.storageDrivers) {
      const driver = this.drivers.get(driverId) as StorageDriver
      if (driver?.checkPostconditions) {
        try {
          await driver.checkPostconditions(change)
        } catch (error) {
          // Postcondition failures are always fatal - data may be inconsistent
          throw new KernelError(
            `Postcondition check failed for driver ${driverId}: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
          )
        }
      }
    }
    
    // Report non-fatal errors
    if (errors.length > 0) {
      this.log(`${errors.length} driver(s) had non-fatal errors processing change`, errors)
    }
  }
  
  /**
   * Handle external input from a driver
   * Routes to userspace
   */
  private async handleExternalInput(input: ExternalInput): Promise<void> {
    if (!this.userspaceHandler) {
      throw new KernelError('No userspace handler registered for external input')
    }
    
    try {
      await this.userspaceHandler(input)
    } catch (error) {
      throw new KernelError(
        `Userspace rejected external input from ${input.source}`,
        { cause: error }
      )
    }
  }
  
  /**
   * Health check all drivers
   * @returns Map of driver health status
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const health = new Map<string, boolean>()
    
    for (const [driverId, driver] of this.drivers) {
      try {
        const isHealthy = await driver.isHealthy()
        health.set(driverId, isHealthy)
      } catch (error) {
        health.set(driverId, false)
        this.log(`Driver ${driverId} health check failed`, error)
      }
    }
    
    return health
  }
  
  /**
   * Get all storage drivers
   */
  getStorageDrivers(): StorageDriver[] {
    return Array.from(this.storageDrivers)
      .map(id => this.drivers.get(id) as StorageDriver)
      .filter(Boolean)
  }
  
  /**
   * Get all bridge drivers
   */
  getBridgeDrivers(): BridgeDriver[] {
    return Array.from(this.bridgeDrivers)
      .map(id => this.drivers.get(id) as BridgeDriver)
      .filter(Boolean)
  }
  
  /**
   * Check if kernel has pending work
   */
  hasPendingWork(): boolean {
    return this.pendingOperations.size > 0
  }
  
  /**
   * Wait for all pending operations to complete
   * Useful for testing and shutdown
   */
  async waitForCompletion(): Promise<void> {
    await Promise.all(this.pendingOperations)
  }
  
  /**
   * Shutdown the kernel and all drivers
   */
  async shutdown(): Promise<void> {
    // Wait for any pending operations to complete first
    await this.waitForCompletion()
    
    const driverIds = Array.from(this.drivers.keys())
    
    for (const driverId of driverIds) {
      try {
        await this.unregisterDriver(driverId)
      } catch (error) {
        this.log(`Failed to unregister driver ${driverId} during shutdown`, error)
      }
    }
    
    this.userspaceHandler = undefined
  }
  
  // Type guards
  private isBridgeDriver(driver: Driver): driver is BridgeDriver {
    return 'setInputHandler' in driver && 
           'startListening' in driver && 
           'stopListening' in driver
  }
  
  private isStorageDriver(driver: Driver): driver is StorageDriver {
    return 'loadGroup' in driver && 
           'getCapabilities' in driver
  }
  
  // Utilities
  private log(message: string, ...args: unknown[]): void {
    if (this.bassline.debug) {
      console.log(`[Kernel] ${message}`, ...args)
    }
  }
}