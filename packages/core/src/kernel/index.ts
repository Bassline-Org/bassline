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

// Concrete Bridge Implementations
export { WebSocketBridgeDriver } from './bridges/websocket-bridge-driver'
export type { WebSocketBridgeConfig } from './bridges/websocket-bridge-driver'

export { WebSocketServerBridgeDriver } from './bridges/websocket-server-bridge-driver'
export type { WebSocketServerBridgeConfig } from './bridges/websocket-server-bridge-driver'

export { HTTPBridgeDriver } from './bridges/http-bridge-driver'
export type { HTTPBridgeConfig } from './bridges/http-bridge-driver'

export { IPCBridgeDriver } from './bridges/ipc-bridge-driver'
export type { IPCBridgeConfig } from './bridges/ipc-bridge-driver'

export { CLIBridgeDriver } from './drivers/cli-bridge-driver'

// Storage Drivers
export { MemoryStorageDriver } from './drivers/memory-storage-driver'