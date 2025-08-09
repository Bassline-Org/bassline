/**
 * Kernel module exports
 */

// Types
export type {
  ContactChange,
  DriverResponse,
  DriverSuccess,
  ExternalInput,
  KernelResponse,
  KernelAccepted,
  KernelRejected,
  DriverCommand,
  InitializeCommand,
  ShutdownCommand,
  HealthCheckCommand,
  CommandResponse,
  CommandSuccess,
} from './types'

export {
  DriverError,
  CommandError,
  KernelError,
  isDriverError,
  isCommandError,
  isKernelError,
  isKernelRejected,
} from './types'

// Driver interfaces
export type {
  Driver,
  BridgeDriver,
  StorageDriver,
  DriverStats,
  StorageCapabilities,
} from './driver'

// NetworkStorage base class
export { NetworkStorage } from '../storage/interface'

// Kernel
export { Kernel } from './kernel'
export type { KernelBassline } from './kernel'

// Userspace Runtime
export { UserspaceRuntime } from './userspace-runtime'
export type { UserspaceRuntimeConfig } from './userspace-runtime'

// Bridge Drivers
export { AbstractBridgeDriver } from './bridge-driver'
export type { BridgeConfig, BridgeStats } from './bridge-driver'

// Concrete Bridge Implementations (browser-compatible only)
export { WebSocketBridgeDriver } from './bridges/websocket-bridge-driver'
export type { WebSocketBridgeConfig } from './bridges/websocket-bridge-driver'

// Note: Node.js-specific bridges moved to @bassline/cli-drivers:
// - WebSocketServerBridgeDriver  
// - HTTPBridgeDriver
// - IPCBridgeDriver
// - CLIBridgeDriver

// Note: Browser/Remote-specific bridges moved to separate packages:
// - BrowserWorkerBridgeDriver -> @bassline/browser-drivers
// - RemoteWebSocketBridgeDriver -> @bassline/remote-drivers

// Storage Drivers
export { MemoryStorageDriver } from './drivers/memory-storage-driver'

// Primitive Loader Driver
export { PrimitiveLoaderDriver } from './drivers/primitive-loader-driver'