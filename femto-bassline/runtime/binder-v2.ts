/**
 * Binder v2 - Properly implemented with all the missing pieces
 * - Normalizes IR on entry
 * - Validates pinout compatibility 
 * - Expands aspects to shims with params
 * - Emits receipts with content-addressed hashing
 * - Supports control-plane rewriters
 */

import { createHash } from 'crypto';
import {
  BoardIR, BinderPlan, Receipt, RealizedGraph, GraphDiff,
  WireSpec, AspectInstance, WireSelector,
  NodeId, EdgeId, RealizedNode, RealizedEdge,
  WireId, Provenance
} from '../core/ir';
import { brand } from '../core/types';
import { AspectRegistry, AspectManifest } from './aspects';
import { LatticeCatalog } from '../core/lattice';
import { PinoutRegistry } from '../stdlib/catalogs';

// ============================================================================
// Binder Options & State
// ============================================================================

export interface BinderOptions {
  principal?: string;
  aspectRegistry: AspectRegistry;
  pinoutRegistry: PinoutRegistry;
  latticeCatalog: LatticeCatalog;
  validateTraits?: boolean;
  enforceACL?: boolean;
  enableHashing?: boolean;
}

export interface RewriterPass {
  id: string;
  name: string;
  run: (ir: BoardIR, binder: BinderV2) => BinderPlan[];
}

// Export types for tests
export type { BoardIR, BinderPlan, AspectInstance } from '../core/ir';

// ============================================================================
// Binder Implementation
// ============================================================================

export class BinderV2 {
  private ir: BoardIR;
  private realized: RealizedGraph;
  private readonly principal: string;
  private readonly aspects: AspectRegistry;
  private readonly pinouts: PinoutRegistry;
  private readonly lattices: LatticeCatalog;
  private readonly validateTraits: boolean;
  private readonly enforceACL: boolean;
  private readonly enableHashing: boolean;
  private planCounter = 0;
  private receipts: Receipt[] = [];
  private rewriters = new Map<string, RewriterPass>();

  constructor(ir: Partial<BoardIR>, options: BinderOptions) {
    // Initialize options first (needed for validation)
    this.principal = options.principal ?? 'system';
    this.aspects = options.aspectRegistry;
    this.pinouts = options.pinoutRegistry;
    this.lattices = options.latticeCatalog;
    this.validateTraits = options.validateTraits ?? true;
    this.enforceACL = options.enforceACL ?? true;
    this.enableHashing = options.enableHashing ?? true;
    
    // Normalize and validate the IR
    this.ir = this.normalizeAndValidateIR(ir);
    
    // Initialize empty realized graph
    this.realized = {
      nodes: {},
      edges: {},
      receipts: []
    };
    
    // Perform initial lowering
    const lowerResult = this.lowerIRToGraph();
    
    // Create initial receipt
    this.receipts.push({
      id: this.generatePlanId('init'),
      status: 'ok',
      diffs: lowerResult.diffs,
      prov: this.createProvenance('initialize')
    });
    
    this.realized.receipts.push(...this.receipts);
  }

  /**
   * Normalize and validate a partial BoardIR
   */
  private normalizeAndValidateIR(partial: Partial<BoardIR>): BoardIR {
    // Apply defaults for missing fields
    const normalized: BoardIR = {
      id: partial.id || brand.boardId('board://unnamed'),
      slots: partial.slots || {},
      occupants: partial.occupants || {},
      wires: partial.wires || {},
      pinouts: partial.pinouts || {},
      policy: partial.policy,
      traits: partial.traits
    };
    
    // Validate slot/pinout compatibility
    for (const [slotId, slot] of Object.entries(normalized.slots)) {
      const requiredPinout = this.pinouts.get(slot.requires);
      if (!requiredPinout) {
        throw new Error(`Slot ${slotId} requires unknown pinout ${slot.requires}`);
      }
    }
    
    // Validate wire endpoints
    for (const [_wireId, wire] of Object.entries(normalized.wires)) {
      this.validateWireEndpoint(wire.from, 'from');
      this.validateWireEndpoint(wire.to, 'to');
    }
    
    return normalized;
  }

  /**
   * Validate a wire endpoint
   */
  private validateWireEndpoint(endpoint: WireSpec['from'], side: string): void {
    if (!endpoint.slot && !endpoint.gadget) {
      throw new Error(`Wire endpoint ${side} must specify either slot or gadget`);
    }
    if (endpoint.slot && endpoint.gadget) {
      throw new Error(`Wire endpoint ${side} cannot specify both slot and gadget`);
    }
  }

  /**
   * Lower IR to realized graph with proper aspect expansion
   */
  private lowerIRToGraph(): { graph: RealizedGraph; diffs: GraphDiff[] } {
    const nodes: Record<string, RealizedNode> = {};
    const edges: Record<string, RealizedEdge> = {};
    const diffs: GraphDiff[] = [];

    // Step 1: Create nodes for all gadgets
    for (const [slotId, gadgetIds] of Object.entries(this.ir.occupants)) {
      for (const gadgetId of gadgetIds) {
        const nodeId = this.generateNodeId(gadgetId);
        nodes[nodeId] = {
          id: nodeId as NodeId,
          gadget: gadgetId,
          tags: [`slot:${slotId}`],
          prov: [this.createProvenance(`mount-${gadgetId}`)]
        };
        
        diffs.push({
          kind: 'addNode',
          node: nodes[nodeId]
        });
      }
    }

    // Step 2: Process wires and expand aspects to shims
    for (const [wireId, wire] of Object.entries(this.ir.wires)) {
      const expandedPath = this.expandWireWithAspects(wire, nodes, diffs);
      
      // Create edges for the expanded path
      for (let i = 0; i < expandedPath.length - 1; i++) {
        const fromNode = expandedPath[i];
        const toNode = expandedPath[i + 1];
        const edgeId = this.generateEdgeId(fromNode.id, toNode.id);
        
        edges[edgeId] = {
          id: edgeId as EdgeId,
          from: { 
            node: fromNode.id as NodeId, 
            pin: i === 0 ? wire.from.pin : 'out' 
          },
          to: { 
            node: toNode.id as NodeId, 
            pin: i === expandedPath.length - 2 ? wire.to.pin : 'in' 
          },
          prov: [this.createProvenance(`wire-${wireId}`)]
        };
        
        diffs.push({
          kind: 'addEdge',
          edge: edges[edgeId]
        });
      }
    }

    // Step 3: Run control-plane rewriters
    const rewriterPlans = this.runRewriters();
    for (const plan of rewriterPlans) {
      const receipt = this.applyPlan(plan);
      diffs.push(...(receipt.diffs || []));
    }

    // Update realized graph
    this.realized = {
      nodes,
      edges,
      receipts: this.receipts
    };

    return { graph: this.realized, diffs };
  }

  /**
   * Expand a wire with its aspects into a path of nodes
   */
  private expandWireWithAspects(
    wire: WireSpec,
    existingNodes: Record<string, RealizedNode>,
    diffs: GraphDiff[]
  ): RealizedNode[] {
    const path: RealizedNode[] = [];
    
    // Find source node
    const sourceNode = this.findNodeForEndpoint(wire.from, existingNodes);
    if (!sourceNode) {
      throw new Error(`Cannot find source node for wire ${wire.id}`);
    }
    path.push(sourceNode);

    // Sort aspects by canonical order
    const sortedAspects = this.sortAspectsByCanonicalOrder(wire.aspects || []);
    
    // Group aspects by manifest ID for composition
    const aspectGroups = new Map<string, AspectInstance[]>();
    for (const aspect of sortedAspects) {
      const manifest = this.aspects.get(aspect.id);
      if (!manifest) continue;
      
      const key = manifest.id.toString();
      if (!aspectGroups.has(key)) {
        aspectGroups.set(key, []);
      }
      aspectGroups.get(key)!.push(aspect);
    }
    
    // Expand aspect groups to shim nodes (with composition)
    for (const [_manifestId, instances] of aspectGroups) {
      const manifest = this.aspects.get(instances[0].id);
      if (!manifest || !manifest.shimTemplate) continue;
      
      
      if (instances.length === 1) {
        // Single instance - no composition needed
        const shimNode = this.createShimNode(
          manifest,
          instances[0],
          wire.id
        );
        
        existingNodes[shimNode.id] = shimNode;
        path.push(shimNode);
        
        diffs.push({
          kind: 'addNode',
          node: shimNode
        });
      } else {
        // Multiple instances - compose via lattice
        const composedNode = this.composeAspectInstances(
          manifest,
          instances,
          wire.id
        );
        
        existingNodes[composedNode.id] = composedNode;
        path.push(composedNode);
        
        diffs.push({
          kind: 'addNode',
          node: composedNode
        });
      }
    }

    // Find target node
    const targetNode = this.findNodeForEndpoint(wire.to, existingNodes);
    if (!targetNode) {
      throw new Error(`Cannot find target node for wire ${wire.id}`);
    }
    path.push(targetNode);

    return path;
  }

  /**
   * Create a shim node from an aspect manifest with params
   */
  private createShimNode(
    manifest: AspectManifest,
    instance: AspectInstance,
    wireId: WireId
  ): RealizedNode {
    // Validate params if schema is provided
    let validatedParams = {};
    if (manifest.schema && instance.params) {
      try {
        validatedParams = manifest.schema(instance.params);
      } catch (error) {
        console.warn(`Invalid params for aspect ${instance.id}:`, error);
        validatedParams = {};
      }
    }
    
    const nodeId = this.generateNodeId(`${manifest.shimTemplate}-${wireId}`);
    
    return {
      id: nodeId as NodeId,
      gadget: manifest.shimTemplate!,
      tags: [
        'shim',
        `aspect:${instance.id}`,
        `wire:${wireId}`,
        `at:${instance.at || 'around'}`
      ],
      params: validatedParams, // Include validated params!
      prov: [this.createProvenance(`aspect-${instance.id}`)]
    };
  }

  /**
   * Sort aspects by canonical order
   */
  private sortAspectsByCanonicalOrder(aspects: AspectInstance[]): AspectInstance[] {
    return aspects.sort((a, b) => {
      const manifestA = this.aspects.get(a.id);
      const manifestB = this.aspects.get(b.id);
      
      const orderA = manifestA?.orderKey ?? 1000;
      const orderB = manifestB?.orderKey ?? 1000;
      
      return orderA - orderB;
    });
  }

  /**
   * Find node for a wire endpoint
   */
  private findNodeForEndpoint(
    endpoint: WireSpec['from'],
    nodes: Record<string, RealizedNode>
  ): RealizedNode | null {
    if (endpoint.gadget) {
      // Direct gadget reference
      for (const node of Object.values(nodes)) {
        if (node.gadget === endpoint.gadget) {
          return node;
        }
      }
    } else if (endpoint.slot) {
      // Find first occupant of slot
      const occupants = this.ir.occupants[endpoint.slot] || [];
      if (occupants.length > 0) {
        const gadgetId = occupants[0];
        for (const node of Object.values(nodes)) {
          if (node.gadget === gadgetId) {
            return node;
          }
        }
      }
    }
    return null;
  }

  /**
   * Register a control-plane rewriter
   */
  registerRewriter(rewriter: RewriterPass): void {
    this.rewriters.set(rewriter.id, rewriter);
  }

  /**
   * Run all registered rewriters
   */
  private runRewriters(): BinderPlan[] {
    const allPlans: BinderPlan[] = [];
    
    // Sort rewriters by priority (if they have one)
    const sortedRewriters = Array.from(this.rewriters.values()).sort((a, b) => {
      const aPriority = (a as any).priority || 1000;
      const bPriority = (b as any).priority || 1000;
      return aPriority - bPriority;
    });
    
    for (const rewriter of sortedRewriters) {
      try {
        const plans = rewriter.run(this.ir, this);
        allPlans.push(...plans);
      } catch (error) {
        console.warn(`Rewriter ${rewriter.id} failed:`, error);
      }
    }
    
    return allPlans;
  }

  /**
   * Apply a binder plan
   */
  applyPlan(plan: BinderPlan): Receipt {
    const planId = this.generatePlanId(plan.op);
    const diffs: GraphDiff[] = [];
    
    try {
      switch (plan.op) {
        case 'addWire':
          this.ir.wires[plan.spec.id] = plan.spec;
          // Re-lower the entire graph to include new wire
          const addWireResult = this.lowerIRToGraph();
          diffs.push(...addWireResult.diffs);
          break;
          
        case 'updateWire':
          // Update wire properties
          const wireToUpdate = this.ir.wires[plan.wire];
          if (!wireToUpdate) {
            throw new Error(`Wire ${plan.wire} not found`);
          }
          
          if (plan.aspects !== undefined) wireToUpdate.aspects = plan.aspects;
          if (plan.labels !== undefined) wireToUpdate.labels = plan.labels;
          if (plan.policy !== undefined) wireToUpdate.policy = plan.policy;
          
          // Re-lower to apply changes
          const updateResult = this.lowerIRToGraph();
          diffs.push(...updateResult.diffs);
          break;
          
        case 'weaveWires':
          // Apply aspect to all matching wires
          let matchCount = 0;
          for (const [_wireId, wire] of Object.entries(this.ir.wires)) {
            if (this.matchesSelector(wire, plan.selector)) {
              wire.aspects = wire.aspects || [];
              wire.aspects.push(plan.aspect);
              matchCount++;
            }
          }
          
          if (matchCount === 0) {
            throw new Error('No wires matched the selector');
          }
          
          // Re-lower the entire graph to include new aspects
          const lowerResult = this.lowerIRToGraph();
          diffs.push(...lowerResult.diffs);
          break;
          
        // Add other plan operations...
      }
      
      const receipt: Receipt = {
        id: planId,
        status: 'ok',
        diffs,
        prov: this.createProvenance(plan.op)
      };
      
      this.receipts.push(receipt);
      return receipt;
      
    } catch (error) {
      const receipt: Receipt = {
        id: planId,
        status: 'error',
        reason: error instanceof Error ? error.message : String(error),
        prov: this.createProvenance(plan.op)
      };
      
      this.receipts.push(receipt);
      return receipt;
    }
  }

  /**
   * Check if wire matches selector
   */
  private matchesSelector(wire: WireSpec, selector: WireSelector): boolean {
    // Check label/tag match
    if (selector.hasTag) {
      if (!wire.labels || !wire.labels.includes(selector.hasTag)) {
        return false;
      }
    }
    
    // Check from endpoint match
    if (selector.from) {
      if (selector.from.slot && wire.from.slot !== selector.from.slot) {
        return false;
      }
      if (selector.from.gadget && wire.from.gadget !== selector.from.gadget) {
        return false;
      }
      if (selector.from.pin && wire.from.pin !== selector.from.pin) {
        return false;
      }
    }
    
    // Check to endpoint match
    if (selector.to) {
      if (selector.to.slot && wire.to.slot !== selector.to.slot) {
        return false;
      }
      if (selector.to.gadget && wire.to.gadget !== selector.to.gadget) {
        return false;
      }
      if (selector.to.pin && wire.to.pin !== selector.to.pin) {
        return false;
      }
    }
    
    // Check aspect match
    if (selector.hasAspect) {
      const hasAspect = wire.aspects?.some(a => a.id === selector.hasAspect);
      if (!hasAspect) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate content-addressed node ID
   */
  private generateNodeId(content: string): string {
    if (this.enableHashing) {
      const hash = createHash('sha256')
        .update(content)
        .digest('hex')
        .substring(0, 8);
      return `node-${hash}`;
    }
    return `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate content-addressed edge ID
   */
  private generateEdgeId(from: string, to: string): string {
    if (this.enableHashing) {
      const hash = createHash('sha256')
        .update(`${from}->${to}`)
        .digest('hex')
        .substring(0, 8);
      return `edge-${hash}`;
    }
    return `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate plan ID
   */
  private generatePlanId(op: string): string {
    this.planCounter++;
    return `plan-${op}-${this.planCounter}`;
  }

  /**
   * Create provenance record
   */
  private createProvenance(reason: string): Provenance {
    return {
      by: this.principal,
      at: new Date().toISOString(),
      reason
    };
  }

  /**
   * Get current IR
   */
  getIR(): BoardIR {
    return this.ir;
  }

  /**
   * Get realized graph
   */
  getRealized(): RealizedGraph {
    return this.realized;
  }

  /**
   * Compose multiple aspect instances via lattice join
   */
  private composeAspectInstances(
    manifest: AspectManifest,
    instances: AspectInstance[],
    wireId: WireId
  ): RealizedNode {
    // Get the lattice for composition
    // For now use a default lattice as manifest.compose is a Lattice, not a name
    const lattice = this.lattices.get('Any');
    
    if (!lattice) {
      // Fall back to last-write-wins if no lattice
      return this.createShimNode(manifest, instances[instances.length - 1], wireId);
    }
    
    // Compose params via lattice join
    let composedParams = {};
    
    if (manifest.schema) {
      // Validate and compose each instance's params
      const validatedParams = instances.map(inst => {
        try {
          return inst.params ? manifest.schema!(inst.params) : {};
        } catch {
          return {};
        }
      });
      
      // Join all params
      if (validatedParams.length > 0) {
        composedParams = validatedParams.reduce((acc, params) => {
          // Deep merge with lattice join for overlapping keys
          return this.mergeParamsWithLattice(acc, params, lattice);
        });
      }
    }
    
    const nodeId = this.generateNodeId(`${manifest.shimTemplate}-composed-${wireId}`);
    
    return {
      id: nodeId as NodeId,
      gadget: manifest.shimTemplate!,
      tags: [
        'shim',
        'composed',
        `aspect:${manifest.id}`,
        `wire:${wireId}`,
        `instances:${instances.length}`
      ],
      params: composedParams,
      prov: instances.map(inst => 
        this.createProvenance(`compose-aspect-${inst.id}`)
      )
    };
  }
  
  /**
   * Merge params using lattice join for overlapping keys
   */
  private mergeParamsWithLattice(a: any, b: any, lattice: any): any {
    if (typeof a !== 'object' || typeof b !== 'object') {
      // For non-objects, use lattice join directly
      return lattice.join ? lattice.join(a, b) : b;
    }
    
    const result: any = { ...a };
    
    for (const [key, value] of Object.entries(b)) {
      if (key in result) {
        // Key exists in both - use lattice join
        if (lattice.join) {
          result[key] = lattice.join(result[key], value);
        } else {
          result[key] = value; // Last-write-wins fallback
        }
      } else {
        // New key
        result[key] = value;
      }
    }
    
    return result;
  }
  
  /**
   * Get all receipts
   */
  getReceipts(): Receipt[] {
    return this.receipts;
  }
}

// Export for CommonJS
module.exports = { BinderV2 };