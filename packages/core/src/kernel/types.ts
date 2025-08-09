/**
 * Core kernel types
 * Defines the fundamental data structures for the kernel/userspace boundary
 */

import type { ContactId, GroupId, WireId } from '../types'

// ============================================================================
// Kernel <-> Driver Communication Protocol
// ============================================================================

/**
 * Change notification from userspace to kernel
 * The kernel routes these to all registered drivers
 */
export interface ContactChange {
  readonly type: 'contact-change'
  readonly contactId: ContactId
  readonly groupId: GroupId
  readonly value: unknown
  readonly timestamp: number
}

/**
 * Driver response to a change - MUST be one of these
 * No silent failures allowed!
 * 
 * Note: Backpressure is a driver-specific implementation detail.
 * Drivers handle their own queuing/buffering internally.
 */
/**
 * DriverResponse is now just success
 * Errors are thrown as DriverError instances
 */
export type DriverResponse = DriverSuccess

export interface DriverSuccess {
  readonly status: 'success'
  readonly metadata?: unknown  // Driver can return any metadata
}

/**
 * DriverError is a proper Error subclass that can be thrown
 * This ensures failures are loud and explicit
 * Drivers handle their own retry logic internally
 */
export class DriverError extends Error {
  readonly fatal: boolean
  readonly originalError?: Error

  constructor(
    message: string,
    options: {
      fatal?: boolean
      originalError?: Error
      cause?: unknown
    } = {}
  ) {
    super(message, { cause: options.cause ?? options.originalError })
    this.name = 'DriverError'
    this.fatal = options.fatal ?? false
    this.originalError = options.originalError
  }
}

/**
 * External input from driver to kernel
 * Drivers use this to send external changes into userspace
 */
export type ExternalInput =
  // Contact Commands
  | ExternalContactUpdate
  | ExternalAddContact
  | ExternalRemoveContact
  // Group Commands
  | ExternalAddGroup
  | ExternalRemoveGroup
  // Wire Commands
  | ExternalCreateWire
  | ExternalRemoveWire
  // Query Commands
  | ExternalQueryContact
  | ExternalQueryGroup
  // Primitive Management Commands
  | ExternalLoadPrimitive
  | ExternalCreatePrimitiveGadget
  | ExternalListPrimitives
  | ExternalListPrimitiveInfo
  | ExternalGetPrimitiveInfo
  // Scheduler Management Commands
  | ExternalSetScheduler
  | ExternalListSchedulers
  | ExternalGetSchedulerInfo

/**
 * Update a contact's value (original functionality)
 */
export interface ExternalContactUpdate {
  readonly type: 'external-contact-update'
  readonly source: string  // Driver name that received this
  readonly contactId: ContactId
  readonly groupId: GroupId
  readonly value: unknown
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Add a new contact to a group
 */
export interface ExternalAddContact {
  readonly type: 'external-add-contact'
  readonly source: string
  readonly groupId: GroupId
  readonly contact: {
    readonly content?: unknown
    readonly blendMode?: 'accept-last' | 'merge'
  }
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Remove a contact
 */
export interface ExternalRemoveContact {
  readonly type: 'external-remove-contact'
  readonly source: string
  readonly contactId: ContactId
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Add a new group
 */
export interface ExternalAddGroup {
  readonly type: 'external-add-group'
  readonly source: string
  readonly parentGroupId?: GroupId
  readonly group: {
    readonly name: string
    readonly primitiveId?: string
  }
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Remove a group
 */
export interface ExternalRemoveGroup {
  readonly type: 'external-remove-group'
  readonly source: string
  readonly groupId: GroupId
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Create a wire between contacts
 */
export interface ExternalCreateWire {
  readonly type: 'external-create-wire'
  readonly source: string
  readonly fromContactId: ContactId
  readonly toContactId: ContactId
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Remove a wire
 */
export interface ExternalRemoveWire {
  readonly type: 'external-remove-wire'
  readonly source: string
  readonly wireId: WireId
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Query a contact's value
 */
export interface ExternalQueryContact {
  readonly type: 'external-query-contact'
  readonly source: string
  readonly contactId: ContactId
  readonly requestId?: string  // To match response with request
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Query a group's structure and state
 */
export interface ExternalQueryGroup {
  readonly type: 'external-query-group'
  readonly source: string
  readonly groupId: GroupId
  readonly includeContacts?: boolean  // Include contact values
  readonly includeWires?: boolean     // Include wire connections
  readonly includeSubgroups?: boolean // Include subgroup info
  readonly requestId?: string  // To match response with request
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Load a primitive module
 */
export interface ExternalLoadPrimitive {
  readonly type: 'external-load-primitive'
  readonly source: string
  readonly moduleSource: {
    readonly type: 'npm' | 'file' | 'url'
    readonly package?: string
    readonly path?: string
    readonly url?: string
    readonly namespace: string
  }
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Create a primitive gadget instance
 */
export interface ExternalCreatePrimitiveGadget {
  readonly type: 'external-create-primitive-gadget'
  readonly source: string
  readonly qualifiedName: string  // e.g., "@bassline/core/add"
  readonly parentGroupId?: GroupId
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Set the active scheduler
 */
export interface ExternalSetScheduler {
  readonly type: 'external-set-scheduler'
  readonly source: string
  readonly schedulerId: string
  readonly config?: unknown
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * List available primitives
 */
export interface ExternalListPrimitives {
  readonly type: 'external-list-primitives'
  readonly source: string
  readonly requestId?: string
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Get detailed information about a specific primitive
 */
export interface ExternalGetPrimitiveInfo {
  readonly type: 'external-get-primitive-info'
  readonly source: string
  readonly qualifiedName: string  // e.g., "@bassline/core/add"
  readonly requestId?: string
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * List all available primitive info (detailed)
 */
export interface ExternalListPrimitiveInfo {
  readonly type: 'external-list-primitive-info'
  readonly source: string
  readonly requestId?: string
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * List available schedulers
 */
export interface ExternalListSchedulers {
  readonly type: 'external-list-schedulers'
  readonly source: string
  readonly requestId?: string
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Get detailed information about a specific scheduler
 */
export interface ExternalGetSchedulerInfo {
  readonly type: 'external-get-scheduler-info'
  readonly source: string
  readonly schedulerId: string
  readonly requestId?: string
  readonly metadata?: {
    readonly timestamp?: number
    readonly [key: string]: unknown
  }
}

/**
 * Kernel response to external input
 * Again, no silent failures!
 */
export type KernelResponse =
  | KernelAccepted
  | KernelRejected

export interface KernelAccepted {
  readonly status: 'accepted'
}

/**
 * KernelError for kernel-side failures
 */
export class KernelError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'KernelError'
  }
}

export interface KernelRejected {
  readonly status: 'rejected'
  readonly reason: string
  readonly error?: KernelError
}

// ============================================================================
// Driver Lifecycle & Commands
// ============================================================================

/**
 * Commands that the kernel can send to drivers
 * These are explicit, typed commands - no ambiguity
 */
export type DriverCommand =
  | InitializeCommand
  | ShutdownCommand
  | HealthCheckCommand

export interface InitializeCommand {
  readonly type: 'initialize'
  readonly config?: unknown  // Driver-specific config
}

export interface ShutdownCommand {
  readonly type: 'shutdown'
  readonly force: boolean  // Force shutdown even with pending operations?
}

export interface HealthCheckCommand {
  readonly type: 'health-check'
}

/**
 * CommandResponse is now just success
 * Errors are thrown as CommandError instances
 */
export type CommandResponse = CommandSuccess

export interface CommandSuccess {
  readonly status: 'success'
  readonly data?: unknown  // Command-specific response data
}

/**
 * CommandError is also an Error subclass for consistency
 */
export class CommandError extends Error {
  readonly canContinue: boolean
  readonly originalError?: Error

  constructor(
    message: string,
    options: {
      canContinue: boolean
      originalError?: Error
      cause?: unknown
    } = {canContinue: false}
  ) {
    super(message, { cause: options.cause ?? options.originalError })
    this.name = 'CommandError'
    this.canContinue = options.canContinue
    this.originalError = options.originalError
  }
}

// ============================================================================
// Type Guards (compile-time safety)
// ============================================================================

export function isDriverError(error: unknown): error is DriverError {
  return error instanceof DriverError
}

export function isKernelRejected(response: KernelResponse): response is KernelRejected {
  return response.status === 'rejected'
}

export function isCommandError(error: unknown): error is CommandError {
  return error instanceof CommandError
}

export function isKernelError(error: unknown): error is KernelError {
  return error instanceof KernelError
}
