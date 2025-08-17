/**
 * Core type definitions for Femto-Bassline
 * Using Zod for runtime validation and type inference
 */

import { z } from 'zod';

// ============================================================================
// IDs & Provenance
// ============================================================================

// ID types with branded strings for type safety
export const GadgetId = z.string().brand('GadgetId').describe('gadget://${string}');
export const BoardId = z.string().brand('BoardId').describe('board://${string}');
export const SlotId = z.string().brand('SlotId').describe('slot://${string}');
export const WireId = z.string().brand('WireId').describe('wire://${string}');
export const PinoutId = z.string().brand('PinoutId').describe('pinout://${string}');
export const AspectId = z.string().brand('AspectId').describe('aspect://${string}@${number}');
export const ContactId = z.string().brand('ContactId').describe('contact://${string}');
export const PinId = z.string().brand('PinId').describe('pin://${string}');

export type GadgetId = z.infer<typeof GadgetId>;
export type BoardId = z.infer<typeof BoardId>;
export type SlotId = z.infer<typeof SlotId>;
export type WireId = z.infer<typeof WireId>;
export type PinoutId = z.infer<typeof PinoutId>;
export type AspectId = z.infer<typeof AspectId>;
export type ContactId = z.infer<typeof ContactId>;
export type PinId = z.infer<typeof PinId>;

// Helper functions to create IDs
export const createGadgetId = (id: string): GadgetId => 
  GadgetId.parse(`gadget://${id}`);
export const createBoardId = (id: string): BoardId => 
  BoardId.parse(`board://${id}`);
export const createSlotId = (id: string): SlotId => 
  SlotId.parse(`slot://${id}`);
export const createWireId = (id: string): WireId => 
  WireId.parse(`wire://${id}`);
export const createPinoutId = (id: string): PinoutId => 
  PinoutId.parse(`pinout://${id}`);
export const createAspectId = (name: string, version: number): AspectId => 
  AspectId.parse(`aspect://${name}@${version}`);

// Provenance tracking
export const Provenance = z.object({
  by: z.string().describe('Principal who made the change'),
  at: z.string().describe('ISO timestamp'),
  reason: z.string().optional().describe('Human-readable reason'),
  passId: z.string().optional().describe('Rewriter pass ID if applicable'),
  inputsHash: z.string().optional().describe('Hash of inputs that produced this')
});

export type Provenance = z.infer<typeof Provenance>;

// ============================================================================
// Pins, Pinouts, Ports
// ============================================================================

export const PinKind = z.enum([
  'PulseIn',   // Receives pulse triggers
  'PulseOut',  // Emits pulse triggers
  'ValueIn',   // Receives lattice values
  'ValueOut',  // Emits lattice values
  'ActionIn',  // Receives action commands
  'EventOut'   // Emits events
]);

export type PinKind = z.infer<typeof PinKind>;

export const PinDef = z.object({
  kind: PinKind,
  domain: z.string().optional().describe('Type/domain tag for validation'),
  lattice: z.string().optional().describe('Lattice name for ValueIn/ValueOut'),
  required: z.boolean().default(false).describe('Whether this pin must be connected')
});

export type PinDef = z.infer<typeof PinDef>;

export const Pinout = z.object({
  id: PinoutId,
  pins: z.record(z.string(), PinDef).describe('Pin name to definition'),
  traits: z.array(z.string()).optional().describe('Traits provided by this pinout')
});

export type Pinout = z.infer<typeof Pinout>;

// ============================================================================
// Traits & Evidence
// ============================================================================

export const TraitId = z.union([
  z.literal('deterministic'),
  z.literal('crdt-safe'),
  z.literal('pure'),
  z.literal('bounded-memory'),
  z.literal('sched:deterministic'),
  z.literal('sched:realtime'),
  z.string() // Allow custom traits
]);

export type TraitId = z.infer<typeof TraitId>;

export const Evidence = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('declared'),
    by: z.string(),
    at: z.string()
  }),
  z.object({
    kind: z.literal('static-proof'),
    tool: z.string(),
    ref: z.string(),
    hash: z.string()
  }),
  z.object({
    kind: z.literal('runtime-attestation'),
    window: z.string(),
    metrics: z.record(z.string(), z.number())
  }),
  z.object({
    kind: z.literal('external-attestation'),
    authority: z.string(),
    sig: z.string()
  })
]);

export type Evidence = z.infer<typeof Evidence>;

export const TraitClaim = z.object({
  trait: TraitId,
  confidence: z.union([
    z.literal(0), // No confidence
    z.literal(1), // Low confidence
    z.literal(2), // Medium confidence
    z.literal(3)  // High confidence
  ]),
  evidence: z.array(Evidence)
});

export type TraitClaim = z.infer<typeof TraitClaim>;

// ============================================================================
// Helper Functions for Creating Branded IDs
// ============================================================================

export const brand = {
  gadgetId: (id: string): GadgetId => GadgetId.parse(id),
  boardId: (id: string): BoardId => BoardId.parse(id),
  slotId: (id: string): SlotId => SlotId.parse(id),
  wireId: (id: string): WireId => WireId.parse(id),
  pinoutId: (id: string): PinoutId => PinoutId.parse(id),
  aspectId: (id: string): AspectId => AspectId.parse(id),
  pinId: (id: string): PinId => PinId.parse(id),
  contactId: (id: string): ContactId => ContactId.parse(id)
};

// ============================================================================
// Gadgets & Specifications
// ============================================================================

export const GadgetSpec = z.object({
  pinouts: z.array(PinoutId).describe('Pinouts this gadget provides'),
  internals: z.any().optional().describe('Internal structure for baked gadgets'),
  params: z.record(z.string(), z.unknown()).optional().describe('Configuration parameters'),
  traits: z.array(TraitClaim).optional().describe('Claimed traits with evidence')
});

export type GadgetSpec = z.infer<typeof GadgetSpec>;

export const GadgetDecl = z.object({
  gadget: GadgetId.describe('Realized gadget ID'),
  provides: z.array(PinoutId).describe('Pinouts provided'),
  pins: z.record(z.string(), z.string()).describe('Pin name to port ID mapping'),
  traits: z.array(TraitClaim).optional()
});

export type GadgetDecl = z.infer<typeof GadgetDecl>;

// ============================================================================
// Values & Lattices (basic types, full implementation in lattice.ts)
// ============================================================================

export const Value = z.unknown().describe('Any propagatable value');
export type Value = z.infer<typeof Value>;

// Pulse for trigger-based propagation
export const Pulse = z.object({
  reqId: z.string().describe('Unique request ID for deduplication'),
  payload: Value.optional().describe('Optional payload data'),
  path: z.array(z.string()).optional().describe('Path taken through network')
});

export type Pulse = z.infer<typeof Pulse>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a string is a valid gadget ID
 */
export function isValidGadgetId(id: string): boolean {
  return id.startsWith('gadget://');
}

/**
 * Validate that a string is a valid board ID
 */
export function isValidBoardId(id: string): boolean {
  return id.startsWith('board://');
}

/**
 * Extract the base name from an aspect ID
 */
export function getAspectName(id: AspectId): string {
  const match = id.match(/^aspect:\/\/(.+)@\d+$/);
  return match ? match[1] : '';
}

/**
 * Extract the version from an aspect ID
 */
export function getAspectVersion(id: AspectId): number {
  const match = id.match(/^aspect:\/\/.+@(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// Export for CommonJS
module.exports = { 
  brand,
  GadgetId,
  BoardId,
  SlotId, 
  WireId,
  PinoutId,
  AspectId,
  ContactId,
  PinId,
  createGadgetId,
  createAspectId
};