/**
 * Graph Intermediate Representation (IR)
 * Defines the desired state (BoardIR) and actual state (RealizedGraph)
 */

import { z } from 'zod';
import {
  GadgetId, BoardId, SlotId, WireId, PinoutId, AspectId,
  Pinout, TraitClaim, Provenance
} from './types';

// Re-export types that are needed
export { GadgetId, BoardId, SlotId, WireId, PinoutId, AspectId, Provenance } from './types';

// ============================================================================
// Wire Specifications (Desired State)
// ============================================================================

/**
 * Endpoint of a wire - connects to a slot's occupant or directly to a gadget
 * Note: Pin kind is validated against pinout at lowering time
 */
export const WireEndpoint = z.object({
  slot: SlotId.optional().describe('Connect to occupant of this slot'),
  gadget: GadgetId.optional().describe('Connect directly to this gadget'),
  pin: z.string().describe('Pin name on the target')
}).refine(
  d => Boolean(d.slot) !== Boolean(d.gadget),
  'Specify exactly one of: slot OR gadget'
);

export type WireEndpoint = z.infer<typeof WireEndpoint>;

/**
 * Aspect instance attached to a wire or other target
 */
export const AspectInstance = z.object({
  id: AspectId,
  at: z.enum(['tapIn', 'tapOut', 'around']).optional().describe('Join point (data-plane only)'),
  params: z.unknown().optional().describe('Aspect configuration')
});

export type AspectInstance = z.infer<typeof AspectInstance>;

/**
 * Wire specification in desired state
 */
export const WireSpec = z.object({
  id: WireId,
  from: WireEndpoint,
  to: WireEndpoint,
  // Unordered bag of aspects; binder/lowering imposes canonical order
  aspects: z.array(AspectInstance).optional().describe('Aspect set (unordered)'),
  labels: z.array(z.string()).optional().describe('Free-form labels for selection'),
  policy: z.record(z.string(), z.unknown()).optional().describe('Wire-specific policies'),
  prov: z.array(Provenance).optional().describe('Creation/modification history')
});

export type WireSpec = z.infer<typeof WireSpec>;

// ============================================================================
// Slot Declarations (Desired State)
// ============================================================================

/**
 * Replica policy for handling multiple occupants in a slot
 */
export const ReplicaPolicy = z.object({
  strategy: z.enum([
    'reduce',  // Merge via lattice
    'any',     // First response wins
    'hedge',   // Race with delay
    'quorum',  // Wait for k responses
    'vote',    // Majority wins
    'all'      // Wait for all
  ]),
  lattice: z.string().optional().describe('Lattice name for reduce strategy'),
  k: z.number().int().positive().optional().describe('Required responses for quorum'),
  delayMs: z.number().int().positive().optional().describe('Hedge delay in milliseconds')
});

export type ReplicaPolicy = z.infer<typeof ReplicaPolicy>;

/**
 * Slot declaration within a board
 */
export const SlotDecl = z.object({
  id: SlotId,
  requires: PinoutId.describe('Required pinout for occupants'),
  capacity: z.number().int().positive().default(1).describe('Max occupants'),
  replicaPolicy: ReplicaPolicy.optional().describe('How to handle multiple occupants'),
  traits: z.array(TraitClaim).optional().describe('Required traits for occupants'),
  policy: z.record(z.string(), z.unknown()).optional().describe('Slot-specific policies')
});

export type SlotDecl = z.infer<typeof SlotDecl>;

// ============================================================================
// Board IR (Desired State)
// ============================================================================

/**
 * Binder policy for controlling board mutations
 */
export const BinderPolicy = z.object({
  // Board-level trait requirements
  boardRequireTraits: z.array(z.string()).optional().describe('Required traits for the board'),
  boardForbidTraits: z.array(z.string()).optional().describe('Forbidden traits for the board'),
  
  // Slot-level trait requirements
  slotRequireTraits: z.record(z.string(), z.array(z.string())).optional()
    .describe('Required traits by slot'),
  slotForbidTraits: z.record(z.string(), z.array(z.string())).optional()
    .describe('Forbidden traits by slot'),
  
  // Access control
  acl: z.object({
    installAspect: z.record(
      z.string(), // principal
      z.union([z.array(AspectId), z.literal('*')])
    ).optional().describe('Who can install which aspects'),
    
    mutateBoard: z.array(z.string()).optional().describe('Principals who can mutate')
  }).optional(),
  
  // Resource budgets
  budgets: z.object({
    maxTaps: z.number().optional(),
    maxAspectsPerWire: z.number().optional(),
    maxOccupantsPerSlot: z.number().optional()
  }).optional().describe('Resource limits')
});

export type BinderPolicy = z.infer<typeof BinderPolicy>;

/**
 * Board Intermediate Representation - the desired state
 */
export const BoardIR = z.object({
  id: BoardId,
  
  // Structure
  slots: z.record(z.string(), SlotDecl).describe('Available slots'),
  occupants: z.record(z.string(), z.array(GadgetId)).describe('Current occupants per slot'),
  wires: z.record(z.string(), WireSpec).describe('Wire connections'),
  pinouts: z.record(z.string(), Pinout).describe('Available pinouts'),
  
  // Policies and metadata
  policy: BinderPolicy.optional().describe('Binder enforcement policy'),
  traits: z.array(TraitClaim).optional().describe('Board-level traits'),
  prov: z.array(Provenance).optional().describe('Board creation/modification history')
});

export type BoardIR = z.infer<typeof BoardIR>;

// ============================================================================
// Realized Graph (Actual State)
// ============================================================================

/**
 * Node in the realized graph (a gadget or shim)
 */
export const NodeId = z.string().brand('NodeId');
export type NodeId = z.infer<typeof NodeId>;

export const RealizedNode = z.object({
  id: NodeId,
  gadget: GadgetId.describe('The gadget this node represents'),
  tags: z.array(z.string()).optional().describe('Tags like "shim", "aspect:RateLimit"'),
  params: z.any().optional().describe('Parameters for the gadget (e.g., aspect config)'),
  prov: z.array(Provenance).optional().describe('How this node was created')
});

export type RealizedNode = z.infer<typeof RealizedNode>;

/**
 * Edge in the realized graph (a connection between nodes)
 */
export const EdgeId = z.string().brand('EdgeId');
export type EdgeId = z.infer<typeof EdgeId>;

export const RealizedEdge = z.object({
  id: EdgeId,
  from: z.object({
    node: NodeId,
    pin: z.string()
  }),
  to: z.object({
    node: NodeId,
    pin: z.string()
  }),
  prov: z.array(Provenance).optional().describe('How this edge was created')
});

export type RealizedEdge = z.infer<typeof RealizedEdge>;

/**
 * Graph diff for tracking changes
 */
export const GraphDiff = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('addNode'), node: RealizedNode }),
  z.object({ kind: z.literal('removeNode'), id: NodeId }),
  z.object({ kind: z.literal('addEdge'), edge: RealizedEdge }),
  z.object({ kind: z.literal('removeEdge'), id: EdgeId }),
  z.object({ kind: z.literal('updateNodeTags'), id: NodeId, tags: z.array(z.string()) }),
  z.object({ kind: z.literal('annotate'), target: z.string(), note: z.string() })
]);

export type GraphDiff = z.infer<typeof GraphDiff>;

/**
 * Receipt for a binder operation
 */
export const Receipt = z.object({
  id: z.string(),
  status: z.enum(['ok', 'error']),
  diffs: z.array(GraphDiff).optional().describe('Graph differences'),
  reason: z.string().optional().describe('Error reason if failed'),
  prov: Provenance.optional()
});

export type Receipt = z.infer<typeof Receipt>;

/**
 * The actual runtime graph after lowering from IR
 */
export const RealizedGraph = z.object({
  nodes: z.record(z.string(), RealizedNode),
  edges: z.record(z.string(), RealizedEdge),
  receipts: z.array(Receipt).describe('Audit trail of changes')
});

export type RealizedGraph = z.infer<typeof RealizedGraph>;

// Type-safe maps for realized graph
export type NodeMap = Record<string & { __brand: 'NodeId' }, RealizedNode>;
export type EdgeMap = Record<string & { __brand: 'EdgeId' }, RealizedEdge>;

// ============================================================================
// Binder Plans (Mutations)
// ============================================================================

/**
 * Wire selector for bulk operations
 */
export const WireSelector = z.object({
  from: z.object({
    slot: SlotId.optional(),
    gadget: GadgetId.optional(),
    pin: z.string().optional()
  }).optional(),
  to: z.object({
    slot: SlotId.optional(),
    gadget: GadgetId.optional(),
    pin: z.string().optional()
  }).optional(),
  hasAspect: AspectId.optional(),
  hasTag: z.string().optional().describe('Match wires with this label')
});

export type WireSelector = z.infer<typeof WireSelector>;

/**
 * Plans that can be executed by the binder
 */
export const BinderPlan = z.discriminatedUnion('op', [
  // Slot operations
  z.object({
    id: z.string(),
    op: z.literal('declareSlot'),
    slot: SlotId,
    requires: PinoutId
  }),
  z.object({
    id: z.string(),
    op: z.literal('setSlotMode'),
    slot: SlotId,
    capacity: z.number(),
    replicaPolicy: ReplicaPolicy.optional()
  }),
  
  // Mount/unmount operations
  z.object({
    id: z.string(),
    op: z.literal('mount'),
    slot: SlotId,
    gadget: GadgetId,
    placement: z.record(z.string(), z.unknown()).optional()
  }),
  z.object({
    id: z.string(),
    op: z.literal('unmount'),
    slot: SlotId,
    gadget: GadgetId.optional()
  }),
  
  // Wire operations
  z.object({
    id: z.string(),
    op: z.literal('addWire'),
    spec: WireSpec
  }),
  z.object({
    id: z.string(),
    op: z.literal('updateWire'),
    wire: WireId,
    aspects: z.array(AspectInstance).optional(),
    labels: z.array(z.string()).optional(),
    policy: z.record(z.string(), z.unknown()).optional()
  }),
  z.object({
    id: z.string(),
    op: z.literal('removeWire'),
    wire: WireId
  }),
  
  // Wire aspect operations
  z.object({
    id: z.string(),
    op: z.literal('weaveWires'),
    selector: WireSelector,
    aspect: AspectInstance
  }),
  
  // Pin aspect operations
  z.object({
    id: z.string(),
    op: z.literal('installPinAspect'),
    slot: SlotId,
    pin: z.string(),
    aspect: AspectInstance
  }),
  
  // Slot aspect operations
  z.object({
    id: z.string(),
    op: z.literal('installSlotAspect'),
    slot: SlotId,
    aspect: AspectInstance
  }),
  
  // Board aspect operations
  z.object({
    id: z.string(),
    op: z.literal('installBoardAspect'),
    aspect: AspectInstance
  }),
  
  // Binder aspect operations
  z.object({
    id: z.string(),
    op: z.literal('installBinderAspect'),
    aspect: AspectInstance
  }),
  
  // Policy operations
  z.object({
    id: z.string(),
    op: z.literal('setPolicy'),
    policy: BinderPolicy
  }),
  
  // Validation and compilation
  z.object({
    id: z.string(),
    op: z.literal('validate'),
    dryRun: z.literal(true)
  }),
  z.object({
    id: z.string(),
    op: z.literal('bake'),
    target: z.enum(['wasm', 'js', 'native']),
    debugFacet: z.boolean().optional()
  })
]);

export type BinderPlan = z.infer<typeof BinderPlan>;

// ============================================================================
// Interrupt Plans (Control Flow)
// ============================================================================

/**
 * Scope for interrupt operations
 */
export const InterruptScope = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('slot'),
    slot: SlotId
  }),
  z.object({
    kind: z.literal('board')
  }),
  z.object({
    kind: z.literal('match'),
    selector: WireSelector
  })
]);

export type InterruptScope = z.infer<typeof InterruptScope>;

/**
 * Injection point for interrupt shims
 */
export const InjectionPoint = z.enum(['upstream', 'downstream', 'domain', 'route']);
export type InjectionPoint = z.infer<typeof InjectionPoint>;

/**
 * Interrupt control plans
 */
export const InterruptPlan = z.discriminatedUnion('op', [
  z.object({
    id: z.string(),
    op: z.literal('pause'),
    scope: InterruptScope,
    level: z.union([z.literal(0), z.literal(1)]),
    injection: InjectionPoint.optional()
  }),
  z.object({
    id: z.string(),
    op: z.literal('resume'),
    scope: InterruptScope
  }),
  z.object({
    id: z.string(),
    op: z.literal('drain'),
    scope: InterruptScope,
    fenceId: z.string().optional(),
    timeoutMs: z.number().optional()
  }),
  z.object({
    id: z.string(),
    op: z.literal('throttle'),
    scope: InterruptScope,
    rps: z.number(),
    burst: z.number().optional()
  }),
  z.object({
    id: z.string(),
    op: z.literal('isolate'),
    scope: InterruptScope,
    sink: z.enum(['null', 'quarantine']).optional()
  })
]);

export type InterruptPlan = z.infer<typeof InterruptPlan>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty board IR
 */
export function createEmptyBoardIR(id: string): BoardIR {
  return {
    id: BoardId.parse(id),
    slots: {},
    occupants: {},
    wires: {},
    pinouts: {}
  };
}

/**
 * Create an empty realized graph
 */
export function createEmptyRealizedGraph(): RealizedGraph {
  return {
    nodes: {},
    edges: {},
    receipts: []
  };
}

/**
 * Check if a wire selector matches a wire spec
 */
export function matchesSelector(wire: WireSpec, selector: WireSelector): boolean {
  if (selector.from) {
    if (selector.from.slot && wire.from.slot !== selector.from.slot) return false;
    if (selector.from.gadget && wire.from.gadget !== selector.from.gadget) return false;
    if (selector.from.pin && wire.from.pin !== selector.from.pin) return false;
  }
  
  if (selector.to) {
    if (selector.to.slot && wire.to.slot !== selector.to.slot) return false;
    if (selector.to.gadget && wire.to.gadget !== selector.to.gadget) return false;
    if (selector.to.pin && wire.to.pin !== selector.to.pin) return false;
  }
  
  if (selector.hasAspect) {
    const hasAspect = wire.aspects?.some(a => a.id === selector.hasAspect);
    if (!hasAspect) return false;
  }
  
  if (selector.hasTag) {
    if (!wire.labels?.includes(selector.hasTag)) return false;
  }
  
  return true;
}

/**
 * Validate node/edge map keys match their IDs
 */
export function validateGraphKeys(graph: RealizedGraph): boolean {
  // Check all node keys match node IDs
  for (const [key, node] of Object.entries(graph.nodes)) {
    if (key !== node.id) return false;
  }
  
  // Check all edge keys match edge IDs
  for (const [key, edge] of Object.entries(graph.edges)) {
    if (key !== edge.id) return false;
  }
  
  return true;
}

// ============================================================================
// Design Invariants (enforced by binder)
// ============================================================================

/**
 * Core invariants that must hold:
 * 
 * 1. IR is the source of truth; realized graph is always a projection
 * 2. Binder is the only mutator - applies plans → updates IR → re-lowers
 * 3. Aspects in IR are unordered; canonical order comes from registry manifests
 * 4. Overlapping aspects compose via manifest's lattice join, never overwrite
 * 5. Single-writer binder per board; evaluation is fully concurrent
 * 6. Content addressing via normalized hashing ensures reproducibility
 * 7. Every structural change has full provenance tracking
 */