import { z } from 'zod'


// ================================
// Base Schemas
// ================================

// Port definition schema
const PortSchema = z.object({
  name: z.string(),
  value: z.any().optional(),
  attributes: z.record(z.string(), z.any()).optional().transform(val => val as Record<string, any>),
  connectionLimit: z.union([z.number(), z.null()]).optional().default(null) // null = unlimited, number = max connections
})

// Gadget interface schema
const GadgetInterfaceSchema = z.object({
  inputs: z.array(PortSchema),
  outputs: z.array(PortSchema)
})

// Input handler schema (opaque term structure)
const InputHandlerSchema = z.tuple([z.string(), z.any()])

// Connection path schema - exactly 2 elements: [gadgetId, portName]
const ConnectionPathSchema = z.tuple([z.string(), z.string()])

// ================================
// Command Schemas
// ================================

// setInterface command: ['setInterface', { inputs: [...], outputs: [...] }]
export const SetInterfaceSchema = z.tuple([
  z.literal('setInterface'),
  GadgetInterfaceSchema
])

// set-input-handler command: ['set-input-handler', portName, [string, handler]]
export const SetInputHandlerSchema = z.tuple([
  z.literal('set-input-handler'),
  z.string(),
  InputHandlerSchema
])

// set-connection-limit command: ['set-connection-limit', portName, limit]
export const SetConnectionLimitSchema = z.tuple([
  z.literal('set-connection-limit'),
  z.string(),
  z.union([z.number(), z.null()])
])

// connect command: ['connect', sourcePort, targetPath]
export const ConnectSchema = z.tuple([
  z.literal('connect'),
  z.string(),
  ConnectionPathSchema
])

// connect-and-sync command: ['connect-and-sync', sourcePort, targetPath]
export const ConnectAndSyncSchema = z.tuple([
  z.literal('connect-and-sync'),
  z.string(),
  ConnectionPathSchema
])

// batch command: ['batch', [command1, command2, ...]]
export const BatchSchema = z.tuple([
  z.literal('batch'),
  z.array(z.any()) // Array of commands
])

// ================================
// Union Schema for All Commands
// ================================

export const CommandSchema = z.union([
  SetInterfaceSchema,
  SetInputHandlerSchema,
  SetConnectionLimitSchema,
  ConnectSchema,
  ConnectAndSyncSchema,
  BatchSchema
])

// ================================
// Type Exports
// ================================

export type SetInterfaceCommand = z.infer<typeof SetInterfaceSchema>
export type SetInputHandlerCommand = z.infer<typeof SetInputHandlerSchema>
export type SetConnectionLimitCommand = z.infer<typeof SetConnectionLimitSchema>
export type ConnectCommand = z.infer<typeof ConnectSchema>
export type ConnectAndSyncCommand = z.infer<typeof ConnectAndSyncSchema>
export type BatchCommand = z.infer<typeof BatchSchema>
export type Command = z.infer<typeof CommandSchema>

export type GadgetInterface = z.infer<typeof GadgetInterfaceSchema>
export type PortDefinition = z.infer<typeof PortSchema>
