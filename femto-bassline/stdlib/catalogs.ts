/**
 * Standard Library Catalogs
 * Provides default registries for aspects, pinouts, and lattices
 */

import { AspectRegistry } from '../runtime/aspects';
import { LatticeCatalog, createDefaultCatalog as createDefaultLatticeCatalog } from '../core/lattice';
import { Pinout, PinoutId, brand } from '../core/types';
import { TapAspect } from './shims/tap';
import { RateLimitAspect } from './shims/rate-limit';

/**
 * Pinout Registry - Standard pinout definitions
 */
export class PinoutRegistry {
  private pinouts = new Map<PinoutId, Pinout>();
  
  register(pinout: Pinout): void {
    this.pinouts.set(pinout.id, pinout);
  }
  
  get(id: PinoutId): Pinout | undefined {
    return this.pinouts.get(id);
  }
  
  list(): Pinout[] {
    return Array.from(this.pinouts.values());
  }
  
  /**
   * Validate that a gadget's pinout is compatible with a slot's required pinout
   */
  validateCompatibility(provided: PinoutId, required: PinoutId): boolean {
    const providedPinout = this.get(provided);
    const requiredPinout = this.get(required);
    
    if (!providedPinout || !requiredPinout) {
      return false;
    }
    
    // Check that all required pins are provided
    for (const [pinName, requiredPin] of Object.entries(requiredPinout.pins)) {
      const providedPin = providedPinout.pins[pinName];
      if (!providedPin) return false;
      if (providedPin.kind !== requiredPin.kind) return false;
    }
    
    return true;
  }
}

/**
 * Create default aspect registry with standard aspects
 */
export function createDefaultAspectRegistry(): AspectRegistry {
  const registry = new AspectRegistry();
  
  // Register standard shim aspects
  registry.register(TapAspect);
  registry.register(RateLimitAspect);
  
  // Add more aspects as they're created
  
  return registry;
}

/**
 * Create default pinout registry with standard pinouts
 */
export function createDefaultPinoutRegistry(): PinoutRegistry {
  const registry = new PinoutRegistry();
  
  // Math pinouts
  registry.register({
    id: brand.pinoutId('pinout://binary-math'),
    pins: {
      'a': { kind: 'ValueIn' },
      'b': { kind: 'ValueIn' },
      'result': { kind: 'ValueOut' }
    }
  });
  
  registry.register({
    id: brand.pinoutId('pinout://unary-math'),
    pins: {
      'value': { kind: 'ValueIn' },
      'result': { kind: 'ValueOut' }
    }
  });
  
  // Value I/O pinouts
  registry.register({
    id: brand.pinoutId('pinout://value-io'),
    pins: {
      'in': { kind: 'ValueIn' },
      'out': { kind: 'ValueOut' }
    }
  });
  
  // Tap pinout
  registry.register({
    id: brand.pinoutId('pinout://tap-io'),
    pins: {
      'in': { kind: 'ValueIn' },
      'out': { kind: 'ValueOut' },
      'monitor': { kind: 'EventOut' }
    }
  });
  
  // Rate limit pinout
  registry.register({
    id: brand.pinoutId('pinout://rate-limit-io'),
    pins: {
      'in': { kind: 'ValueIn' },
      'out': { kind: 'ValueOut' },
      'backpressure': { kind: 'EventOut' },
      'stats': { kind: 'ValueOut' }
    }
  });
  
  // Generic math pinout (simplified)
  registry.register({
    id: brand.pinoutId('pinout://math'),
    pins: {
      'a': { kind: 'ValueIn' },
      'b': { kind: 'ValueIn' },
      'result': { kind: 'ValueOut' }
    }
  });
  
  return registry;
}

/**
 * Export the default lattice catalog creator
 */
export { createDefaultCatalog as createDefaultLatticeCatalog } from '../core/lattice';

/**
 * Combined catalog options for binder
 */
export interface CatalogOptions {
  aspectRegistry?: AspectRegistry;
  pinoutRegistry?: PinoutRegistry;
  latticeCatalog?: LatticeCatalog;
}

/**
 * Create all default catalogs
 */
export function createDefaultCatalogs(): Required<CatalogOptions> {
  return {
    aspectRegistry: createDefaultAspectRegistry(),
    pinoutRegistry: createDefaultPinoutRegistry(),
    latticeCatalog: createDefaultLatticeCatalog()
  };
}

// Export for CommonJS
module.exports = {
  PinoutRegistry,
  createDefaultAspectRegistry,
  createDefaultPinoutRegistry,
  createDefaultLatticeCatalog,
  createDefaultCatalogs
};