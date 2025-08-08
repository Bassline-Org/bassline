/**
 * Core kernel types
 * Defines the fundamental data structures for the kernel/userspace boundary
 */

import type { ContactId, GroupId } from '../types'

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
export interface ExternalInput {
  readonly type: 'external-input'
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
