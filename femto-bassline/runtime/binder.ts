/**
 * Binder - The sole authority for structural mutations
 * Applies plans to IR, validates, and lowers to realized graph
 */

import { z } from 'zod';
import crypto from 'crypto';
import {
  BoardIR, BinderPlan, Receipt, RealizedGraph, GraphDiff,
  WireSpec, SlotDecl, AspectInstance, WireSelector,
  createEmptyBoardIR, createEmptyRealizedGraph,
  matchesSelector, validateGraphKeys,
  NodeId, EdgeId, RealizedNode, RealizedEdge
} from '../core/ir';
import { 
  createGadgetId, createWireId, createSlotId,
  type GadgetId, type Provenance 
} from '../core/types';
import { AspectRegistry } from './aspects';
import { LatticeCatalog } from '../core/lattice';

// ============================================================================
// Binder Implementation
// ============================================================================

export interface BinderOptions {
  principal?: string;
  aspectRegistry: AspectRegistry;
  latticeCatalog: LatticeCatalog;
  validateTraits?: boolean;
  enforceACL?: boolean;
}

export class Binder {
  private ir: BoardIR;
  private realized: RealizedGraph;
  private readonly principal: string;
  private readonly aspects: AspectRegistry;
  private readonly lattices: LatticeCatalog;
  private readonly validateTraits: boolean;
  private readonly enforceACL: boolean;
  private planCounter = 0;

  constructor(ir: BoardIR, options: BinderOptions) {
    this.ir = ir;
    this.realized = createEmptyRealizedGraph();
    this.principal = options.principal ?? 'system';
    this.aspects = options.aspectRegistry;
    this.lattices = options.latticeCatalog;
    this.validateTraits = options.validateTraits ?? true;
    this.enforceACL = options.enforceACL ?? true;
    
    // Initial lowering
    this.lower();
  }

  /**
   * Apply a plan to the IR
   */
  async apply(plan: BinderPlan): Promise<Receipt> {
    const planId = plan.id || `plan-${++this.planCounter}`;
    
    try {
      // Validate plan
      const validation = this.validatePlan(plan);
      if (!validation.valid) {
        return this.errorReceipt(planId, validation.reason!);
      }

      // Check ACL if enforced
      if (this.enforceACL && !this.checkACL(plan)) {
        return this.errorReceipt(planId, 'Permission denied');
      }

      // Execute plan based on operation
      const diffs = await this.executePlan(plan);
      
      // Re-lower after IR changes
      this.lower();
      
      // Create success receipt
      return this.successReceipt(planId, diffs);
    } catch (error) {
      return this.errorReceipt(planId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Execute a plan and return graph diffs
   */
  private async executePlan(plan: BinderPlan): Promise<GraphDiff[]> {
    const diffs: GraphDiff[] = [];

    switch (plan.op) {
      case 'declareSlot': {
        const slot: SlotDecl = {
          id: plan.slot,
          requires: plan.requires,
          capacity: 1,
          traits: [],
          policy: {}
        };
        this.ir.slots[plan.slot] = slot;
        this.ir.occupants[plan.slot] = [];
        break;
      }

      case 'setSlotMode': {
        const slot = this.ir.slots[plan.slot];
        if (!slot) throw new Error(`Slot ${plan.slot} not found`);
        slot.capacity = plan.capacity;
        if (plan.replicaPolicy) {
          slot.replicaPolicy = plan.replicaPolicy;
        }
        break;
      }

      case 'mount': {
        const slot = this.ir.slots[plan.slot];
        if (!slot) throw new Error(`Slot ${plan.slot} not found`);
        
        const occupants = this.ir.occupants[plan.slot] || [];
        if (occupants.length >= slot.capacity) {
          throw new Error(`Slot ${plan.slot} at capacity`);
        }
        
        occupants.push(plan.gadget);
        this.ir.occupants[plan.slot] = occupants;
        break;
      }

      case 'unmount': {
        const occupants = this.ir.occupants[plan.slot] || [];
        if (plan.gadget) {
          const idx = occupants.indexOf(plan.gadget);
          if (idx >= 0) occupants.splice(idx, 1);
        } else {
          // Unmount all
          this.ir.occupants[plan.slot] = [];
        }
        break;
      }

      case 'addWire': {
        this.ir.wires[plan.spec.id] = plan.spec;
        break;
      }

      case 'updateWire': {
        const wire = this.ir.wires[plan.wire];
        if (!wire) throw new Error(`Wire ${plan.wire} not found`);
        
        if (plan.aspects !== undefined) wire.aspects = plan.aspects;
        if (plan.labels !== undefined) wire.labels = plan.labels;
        if (plan.policy !== undefined) wire.policy = plan.policy;
        break;
      }

      case 'removeWire': {
        delete this.ir.wires[plan.wire];
        break;
      }

      case 'weaveWires': {
        // Add aspect to all matching wires
        for (const [id, wire] of Object.entries(this.ir.wires)) {
          if (matchesSelector(wire, plan.selector)) {
            wire.aspects = wire.aspects || [];
            wire.aspects.push(plan.aspect);
          }
        }
        break;
      }

      case 'installPinAspect':
      case 'installSlotAspect':
      case 'installBoardAspect':
      case 'installBinderAspect': {
        // These would be stored separately in the IR
        // For now, add to a generic aspects array
        if (!this.ir.policy) this.ir.policy = {};
        // TODO: Implement aspect storage for non-wire targets
        break;
      }

      case 'setPolicy': {
        this.ir.policy = plan.policy;
        break;
      }

      case 'validate': {
        // Dry run - no changes
        return diffs;
      }

      case 'bake': {
        // TODO: Implement baking
        throw new Error('Baking not yet implemented');
      }
    }

    // Add provenance
    this.addProvenance(plan);
    
    return diffs;
  }

  /**
   * Validate a plan before execution
   */
  private validatePlan(plan: BinderPlan): { valid: boolean; reason?: string } {
    try {
      // Parse with Zod to ensure type safety
      BinderPlan.parse(plan);

      // Additional semantic validation based on op
      switch (plan.op) {
        case 'mount': {
          const slot = this.ir.slots[plan.slot];
          if (!slot) return { valid: false, reason: `Slot ${plan.slot} not found` };
          
          // TODO: Validate gadget matches slot's required pinout
          // TODO: Validate traits if enforced
          break;
        }

        case 'addWire': {
          // Validate endpoints exist
          const wire = plan.spec;
          if (wire.from.slot && !this.ir.slots[wire.from.slot]) {
            return { valid: false, reason: `Source slot ${wire.from.slot} not found` };
          }
          if (wire.to.slot && !this.ir.slots[wire.to.slot]) {
            return { valid: false, reason: `Target slot ${wire.to.slot} not found` };
          }
          break;
        }
      }

      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        reason: error instanceof Error ? error.message : 'Validation failed' 
      };
    }
  }

  /**
   * Check ACL permissions for a plan
   */
  private checkACL(plan: BinderPlan): boolean {
    if (!this.ir.policy?.acl) return true;

    // Check mutation permissions
    if (this.ir.policy.acl.mutateBoard) {
      if (!this.ir.policy.acl.mutateBoard.includes(this.principal)) {
        return false;
      }
    }

    // Check aspect installation permissions
    if (plan.op.includes('Aspect')) {
      const aspectPerms = this.ir.policy.acl.installAspect;
      if (aspectPerms) {
        const allowed = aspectPerms[this.principal];
        if (!allowed) return false;
        if (allowed !== '*') {
          // Check specific aspect ID
          // TODO: Extract aspect ID from plan
        }
      }
    }

    return true;
  }

  /**
   * Lower IR to realized graph
   * This is where aspects become shims and canonical ordering is applied
   */
  private lower(): void {
    const nodes: Record<string, RealizedNode> = {};
    const edges: Record<string, RealizedEdge> = {};
    let nodeCounter = 0;
    let edgeCounter = 0;

    // Create nodes for mounted gadgets
    for (const [slotId, gadgetIds] of Object.entries(this.ir.occupants)) {
      for (const gadgetId of gadgetIds) {
        const nodeId = `node-${++nodeCounter}` as NodeId;
        nodes[nodeId] = {
          id: nodeId,
          gadget: gadgetId,
          tags: [`slot:${slotId}`],
          prov: []
        };
      }
    }

    // Process wires and create edges (with aspect shims)
    for (const wire of Object.values(this.ir.wires)) {
      // For now, create direct edges
      // TODO: Insert shim nodes for aspects in canonical order
      
      const fromNode = this.findNode(nodes, wire.from);
      const toNode = this.findNode(nodes, wire.to);
      
      if (fromNode && toNode) {
        const edgeId = `edge-${++edgeCounter}` as EdgeId;
        edges[edgeId] = {
          id: edgeId,
          from: { node: fromNode, pin: wire.from.pin },
          to: { node: toNode, pin: wire.to.pin },
          prov: wire.prov
        };
      }
    }

    this.realized = {
      nodes,
      edges,
      receipts: this.realized.receipts // Preserve history
    };
  }

  /**
   * Find node ID for a wire endpoint
   */
  private findNode(nodes: Record<string, RealizedNode>, endpoint: WireSpec['from']): NodeId | null {
    if (endpoint.gadget) {
      // Direct gadget reference
      for (const [id, node] of Object.entries(nodes)) {
        if (node.gadget === endpoint.gadget) {
          return id as NodeId;
        }
      }
    } else if (endpoint.slot) {
      // Slot reference - find first occupant
      // TODO: Handle multi-occupancy with replica policy
      for (const [id, node] of Object.entries(nodes)) {
        if (node.tags?.includes(`slot:${endpoint.slot}`)) {
          return id as NodeId;
        }
      }
    }
    return null;
  }

  /**
   * Add provenance to IR
   */
  private addProvenance(plan: BinderPlan): void {
    const prov: Provenance = {
      by: this.principal,
      at: new Date().toISOString(),
      reason: `Applied plan: ${plan.op}`,
      inputsHash: this.hashPlan(plan)
    };

    if (!this.ir.prov) this.ir.prov = [];
    this.ir.prov.push(prov);
  }

  /**
   * Hash a plan for reproducibility
   */
  private hashPlan(plan: BinderPlan): string {
    const normalized = JSON.stringify(plan, Object.keys(plan).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  /**
   * Create success receipt
   */
  private successReceipt(id: string, diffs: GraphDiff[]): Receipt {
    const receipt: Receipt = {
      id,
      status: 'ok',
      diffs,
      prov: {
        by: this.principal,
        at: new Date().toISOString()
      }
    };
    
    this.realized.receipts.push(receipt);
    return receipt;
  }

  /**
   * Create error receipt
   */
  private errorReceipt(id: string, reason: string): Receipt {
    const receipt: Receipt = {
      id,
      status: 'error',
      reason,
      prov: {
        by: this.principal,
        at: new Date().toISOString()
      }
    };
    
    this.realized.receipts.push(receipt);
    return receipt;
  }

  /**
   * Get current IR (read-only)
   */
  getIR(): Readonly<BoardIR> {
    return this.ir;
  }

  /**
   * Get realized graph (read-only)
   */
  getRealized(): Readonly<RealizedGraph> {
    return this.realized;
  }

  /**
   * Get all receipts
   */
  getReceipts(): readonly Receipt[] {
    return this.realized.receipts;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new binder for a board
 */
export function createBinder(
  boardId: string,
  options: BinderOptions
): Binder {
  const ir = createEmptyBoardIR(boardId);
  return new Binder(ir, options);
}

/**
 * Apply multiple plans in sequence
 */
export async function applyPlans(
  binder: Binder,
  plans: BinderPlan[]
): Promise<Receipt[]> {
  const receipts: Receipt[] = [];
  
  for (const plan of plans) {
    const receipt = await binder.apply(plan);
    receipts.push(receipt);
    
    // Stop on first error
    if (receipt.status === 'error') break;
  }
  
  return receipts;
}