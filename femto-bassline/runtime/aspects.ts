/**
 * Aspect System - Opt-in extensibility through composition
 * Manages aspect manifests, canonical ordering, and lattice-based composition
 */

import { z } from 'zod';
import { AspectId, GadgetId, createAspectId, createGadgetId } from '../core/types';
import { Lattice } from '../core/lattice';

// ============================================================================
// Aspect Manifest
// ============================================================================

/**
 * Aspect target scopes
 */
export type AspectTarget = 'wire' | 'pin' | 'slot' | 'board' | 'binder';

/**
 * Aspect manifest defining behavior and composition
 */
export const AspectManifest = z.object({
  id: AspectId,
  name: z.string(),
  version: z.number(),
  
  // Where this aspect can be applied
  targets: z.array(z.enum(['wire', 'pin', 'slot', 'board', 'binder'])),
  
  // Data-plane aspects only
  at: z.enum(['tapIn', 'tapOut', 'around']).optional()
    .describe('Join point for data-plane aspects'),
  
  // Parameter validation
  schema: z.any().optional().describe('Zod schema for params validation'),
  
  // Canonical ordering
  orderKey: z.number().default(1000).describe('Sort order within join point'),
  
  // Composition via lattice
  compose: z.any().optional().describe('Lattice for composing overlapping configs'),
  
  // Data-plane: shim gadget template
  shimTemplate: GadgetId.optional().describe('Gadget to insert for data-plane aspects'),
  
  // Control-plane: rewriter pass
  rewriterId: z.string().optional().describe('Rewriter pass ID for control-plane aspects'),
  
  // Requirements
  requires: z.array(z.string()).optional().describe('Required traits'),
  forbids: z.array(z.string()).optional().describe('Forbidden traits'),
  
  // Auto-wiring for extra pins
  autowire: z.record(z.string(), z.string()).optional()
    .describe('Extra pins to wire (e.g., scheduler credits)'),
  
  // Metadata
  description: z.string().optional(),
  author: z.string().optional()
});

export type AspectManifest = z.infer<typeof AspectManifest>;

// ============================================================================
// Aspect Registry
// ============================================================================

export class AspectRegistry {
  private aspects = new Map<string, AspectManifest>();
  private composeLattices = new Map<string, Lattice<any>>();

  /**
   * Register an aspect manifest
   */
  register(manifest: AspectManifest): void {
    const validated = AspectManifest.parse(manifest);
    this.aspects.set(validated.id, validated);
    
    // Register compose lattice if provided
    if (validated.compose) {
      this.composeLattices.set(validated.id, validated.compose);
    }
  }

  /**
   * Get an aspect manifest by ID
   */
  get(id: AspectId): AspectManifest | undefined {
    return this.aspects.get(id);
  }

  /**
   * List all registered aspects
   */
  list(): AspectManifest[] {
    return Array.from(this.aspects.values());
  }

  /**
   * List aspects for a specific target
   */
  listForTarget(target: AspectTarget): AspectManifest[] {
    return this.list().filter(a => a.targets.includes(target));
  }

  /**
   * Sort aspects in canonical order
   */
  sortCanonically(aspectIds: AspectId[]): AspectId[] {
    const manifests = aspectIds
      .map(id => ({ id, manifest: this.get(id) }))
      .filter(item => item.manifest !== undefined);
    
    // Sort by orderKey, then by ID for stability
    manifests.sort((a, b) => {
      const orderDiff = (a.manifest?.orderKey ?? 1000) - (b.manifest?.orderKey ?? 1000);
      if (orderDiff !== 0) return orderDiff;
      return a.id.localeCompare(b.id);
    });
    
    return manifests.map(m => m.id);
  }

  /**
   * Compose aspect parameters using lattice joins
   */
  composeParams(aspectId: AspectId, params: unknown[]): unknown {
    const manifest = this.get(aspectId);
    if (!manifest) throw new Error(`Aspect ${aspectId} not found`);
    
    const lattice = this.composeLattices.get(aspectId);
    if (!lattice) {
      // No lattice - use last value
      return params[params.length - 1];
    }
    
    // Join all parameters using the lattice
    return params.reduce((acc, p) => lattice.join(acc, p), lattice.bottom());
  }

  /**
   * Validate aspect parameters
   */
  validateParams(aspectId: AspectId, params: unknown): boolean {
    const manifest = this.get(aspectId);
    if (!manifest) return false;
    
    if (manifest.schema) {
      try {
        manifest.schema.parse(params);
        return true;
      } catch {
        return false;
      }
    }
    
    return true; // No schema = any params OK
  }

  /**
   * Check if aspects can be applied together
   */
  checkCompatibility(aspectIds: AspectId[]): { 
    compatible: boolean; 
    reason?: string 
  } {
    const manifests = aspectIds
      .map(id => this.get(id))
      .filter(m => m !== undefined) as AspectManifest[];
    
    // Check for conflicting requirements
    const allRequires = new Set<string>();
    const allForbids = new Set<string>();
    
    for (const manifest of manifests) {
      manifest.requires?.forEach(r => allRequires.add(r));
      manifest.forbids?.forEach(f => allForbids.add(f));
    }
    
    // Check if any required trait is forbidden
    for (const req of allRequires) {
      if (allForbids.has(req)) {
        return { 
          compatible: false, 
          reason: `Trait ${req} is both required and forbidden` 
        };
      }
    }
    
    return { compatible: true };
  }
}

// ============================================================================
// Built-in Aspect Definitions
// ============================================================================

/**
 * Create a tap aspect for observability
 */
export function createTapAspect(): AspectManifest {
  return {
    id: createAspectId('tap', 1),
    name: 'tap',
    version: 1,
    targets: ['wire'],
    at: 'tapOut',
    orderKey: 100, // Early in pipeline
    shimTemplate: createGadgetId('gadget://stdlib/tap'),
    description: 'Observe values passing through a wire',
    autowire: {
      'monitor': 'monitor://default'
    }
  };
}

/**
 * Create a rate limit aspect
 */
export function createRateLimitAspect(): AspectManifest {
  return {
    id: createAspectId('rate-limit', 1),
    name: 'rate-limit',
    version: 1,
    targets: ['wire', 'pin', 'slot'],
    at: 'tapIn',
    orderKey: 200,
    shimTemplate: createGadgetId('gadget://stdlib/rate-limit'),
    schema: z.object({
      rps: z.number().positive(),
      burst: z.number().positive().optional()
    }),
    description: 'Rate limit propagation',
    requires: ['bounded-memory']
  };
}

/**
 * Create a credit gate aspect for scheduling
 */
export function createCreditGateAspect(): AspectManifest {
  return {
    id: createAspectId('credit-gate', 1),
    name: 'credit-gate',
    version: 1,
    targets: ['wire'],
    at: 'tapIn',
    orderKey: 50, // Very early - before most processing
    shimTemplate: createGadgetId('gadget://stdlib/credit-gate'),
    schema: z.object({
      initialCredits: z.number().int().min(0).default(1)
    }),
    description: 'Gate propagation on credit availability',
    autowire: {
      'credits': 'scheduler://credits',
      'demand': 'scheduler://demand'
    }
  };
}

/**
 * Create a validation aspect for board-level policy
 */
export function createValidationAspect(): AspectManifest {
  return {
    id: createAspectId('validation', 1),
    name: 'validation',
    version: 1,
    targets: ['board', 'binder'],
    orderKey: 0, // First in control plane
    rewriterId: 'validation-rewriter',
    schema: z.object({
      rules: z.array(z.object({
        path: z.string(),
        constraint: z.any()
      }))
    }),
    description: 'Validate board structure and mutations'
  };
}

// ============================================================================
// Aspect Lowering Utilities
// ============================================================================

/**
 * Information needed to lower an aspect to a shim
 */
export interface AspectLoweringInfo {
  aspectId: AspectId;
  manifest: AspectManifest;
  shimGadgetId: GadgetId;
  params: unknown;
  autowiring: Record<string, string>;
}

/**
 * Plan aspect lowering for a set of aspects
 */
export function planAspectLowering(
  registry: AspectRegistry,
  aspectIds: AspectId[],
  joinPoint: 'tapIn' | 'tapOut' | 'around'
): AspectLoweringInfo[] {
  // Sort in canonical order
  const sorted = registry.sortCanonically(aspectIds);
  
  const lowerings: AspectLoweringInfo[] = [];
  
  for (const id of sorted) {
    const manifest = registry.get(id);
    if (!manifest) continue;
    
    // Skip if not for this join point
    if (manifest.at !== joinPoint) continue;
    
    // Skip if no shim template (control-plane aspect)
    if (!manifest.shimTemplate) continue;
    
    lowerings.push({
      aspectId: id,
      manifest,
      shimGadgetId: manifest.shimTemplate,
      params: {}, // Would be filled from AspectInstance.params
      autowiring: manifest.autowire || {}
    });
  }
  
  return lowerings;
}

// ============================================================================
// Default Registry
// ============================================================================

/**
 * Create a default aspect registry with built-in aspects
 */
export function createDefaultAspectRegistry(): AspectRegistry {
  const registry = new AspectRegistry();
  
  // Register built-in aspects
  registry.register(createTapAspect());
  registry.register(createRateLimitAspect());
  registry.register(createCreditGateAspect());
  registry.register(createValidationAspect());
  
  return registry;
}