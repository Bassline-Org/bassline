/**
 * Lattice abstractions with Zod validation and property-based testing
 * Ensures mathematical properties and runtime safety
 */

import { z } from 'zod';
import * as fc from 'fast-check';

// ============================================================================
// Core Lattice Interface with Validation
// ============================================================================

/**
 * Generic lattice interface with schema validation
 * All lattices must satisfy:
 * - Reflexivity: a ≤ a
 * - Antisymmetry: a ≤ b ∧ b ≤ a → a = b
 * - Transitivity: a ≤ b ∧ b ≤ c → a ≤ c
 * - Join commutativity: a ⊔ b = b ⊔ a
 * - Join associativity: (a ⊔ b) ⊔ c = a ⊔ (b ⊔ c)
 * - Join idempotence: a ⊔ a = a
 */
export interface Lattice<T, Schema extends z.ZodType<T> = z.ZodType<T>> {
  /** Human-readable name */
  readonly name: string;
  
  /** Zod schema for validation */
  readonly schema: Schema;
  
  /** Check if a ≤ b in the partial order */
  leq(a: T, b: T): boolean;
  
  /** Compute least upper bound a ⊔ b */
  join(a: T, b: T): T;
  
  /** Get the bottom element ⊥ */
  bottom(): T;
  
  /** Optional top element ⊤ */
  top?: () => T;
  
  /** Property test generator */
  arbitrary?: fc.Arbitrary<T>;
  
  /** Custom equality (defaults to ===) */
  equals?: (a: T, b: T) => boolean;
}

// ============================================================================
// Validated Lattice Implementation
// ============================================================================

/**
 * Lattice with built-in Zod validation and property test generation
 */
export class ValidatedLattice<T, S extends z.ZodType<T> = z.ZodType<T>> 
  implements Lattice<T, S> {
  
  constructor(
    public readonly name: string,
    public readonly schema: S,
    private readonly ops: {
      leq: (a: T, b: T) => boolean;
      join: (a: T, b: T) => T;
      bottom: () => T;
      top?: () => T;
      equals?: (a: T, b: T) => boolean;
    },
    public readonly arbitrary?: fc.Arbitrary<T>
  ) {
    // Validate bottom element
    const b = this.bottom();
    this.schema.parse(b);
    
    // Validate top element if provided
    if (ops.top) {
      const t = ops.top();
      this.schema.parse(t);
    }
  }
  
  leq(a: T, b: T): boolean {
    // Validate inputs
    this.schema.parse(a);
    this.schema.parse(b);
    return this.ops.leq(a, b);
  }
  
  join(a: T, b: T): T {
    // Validate inputs
    const validA = this.schema.parse(a);
    const validB = this.schema.parse(b);
    
    // Compute join
    const result = this.ops.join(validA, validB);
    
    // Validate output
    return this.schema.parse(result);
  }
  
  bottom(): T {
    return this.ops.bottom();
  }
  
  get top(): (() => T) | undefined {
    return this.ops.top;
  }
  
  equals(a: T, b: T): boolean {
    return this.ops.equals?.(a, b) ?? (a === b);
  }
  
  /**
   * Generate property tests for lattice laws
   */
  generatePropertyTests(): {
    idempotent: ReturnType<typeof fc.property>;
    commutative: ReturnType<typeof fc.property>;
    associative: ReturnType<typeof fc.property>;
    bottomIdentity: ReturnType<typeof fc.property>;
    ordering: ReturnType<typeof fc.property>;
  } {
    const arb = this.arbitrary ?? zodArbitrary(this.schema);
    const eq = (a: T, b: T) => this.equals(a, b);
    
    return {
      // a ⊔ a = a
      idempotent: fc.property(arb, (a) => {
        const joined = this.join(a, a);
        return eq(joined, a);
      }),
      
      // a ⊔ b = b ⊔ a
      commutative: fc.property(arb, arb, (a, b) => {
        const ab = this.join(a, b);
        const ba = this.join(b, a);
        return eq(ab, ba);
      }),
      
      // (a ⊔ b) ⊔ c = a ⊔ (b ⊔ c)
      associative: fc.property(arb, arb, arb, (a, b, c) => {
        const abc1 = this.join(this.join(a, b), c);
        const abc2 = this.join(a, this.join(b, c));
        return eq(abc1, abc2);
      }),
      
      // ⊥ ⊔ a = a
      bottomIdentity: fc.property(arb, (a) => {
        const joined = this.join(this.bottom(), a);
        return eq(joined, a);
      }),
      
      // a ≤ a ⊔ b
      ordering: fc.property(arb, arb, (a, b) => {
        const joined = this.join(a, b);
        return this.leq(a, joined) && this.leq(b, joined);
      })
    };
  }
}

// ============================================================================
// Zod Arbitrary Generator
// ============================================================================

/**
 * Generate fast-check arbitrary from Zod schema
 */
export function zodArbitrary<T>(schema: z.ZodType<T>): fc.Arbitrary<T> {
  // String
  if (schema instanceof z.ZodString) {
    return fc.string() as any;
  }
  
  // Number
  if (schema instanceof z.ZodNumber) {
    return fc.float({ noNaN: true }) as any;
  }
  
  // Boolean
  if (schema instanceof z.ZodBoolean) {
    return fc.boolean() as any;
  }
  
  // Literal
  if (schema instanceof z.ZodLiteral) {
    return fc.constant(schema.value) as any;
  }
  
  // Enum
  if (schema instanceof z.ZodEnum) {
    return fc.constantFrom(...schema.options) as any;
  }
  
  // Array
  if (schema instanceof z.ZodArray) {
    const elementArb = zodArbitrary(schema.element);
    return fc.array(elementArb) as any;
  }
  
  // Object
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const arbs: Record<string, fc.Arbitrary<any>> = {};
    for (const [key, value] of Object.entries(shape)) {
      arbs[key] = zodArbitrary(value as z.ZodType);
    }
    return fc.record(arbs) as any;
  }
  
  // Union
  if (schema instanceof z.ZodUnion) {
    const options = schema.options as z.ZodType[];
    return fc.oneof(...options.map(zodArbitrary)) as any;
  }
  
  // Optional
  if (schema instanceof z.ZodOptional) {
    return fc.option(zodArbitrary(schema.unwrap())) as any;
  }
  
  // Default fallback
  return fc.anything() as any;
}

// ============================================================================
// Built-in Lattices with Validation
// ============================================================================

/**
 * Pause state lattice for interrupt control
 * Order: running < soft < gated < isolated
 */
export const PauseStateSchema = z.enum(['running', 'soft', 'gated', 'isolated']);
export type PauseState = z.infer<typeof PauseStateSchema>;

export const PauseLattice = new ValidatedLattice(
  'Pause',
  PauseStateSchema,
  {
    leq: (a, b) => {
      const order = ['running', 'soft', 'gated', 'isolated'] as const;
      return order.indexOf(a) <= order.indexOf(b);
    },
    join: (a, b) => {
      const order: PauseState[] = ['running', 'soft', 'gated', 'isolated'];
      return order[Math.max(order.indexOf(a), order.indexOf(b))];
    },
    bottom: () => 'running' as PauseState,
    top: () => 'isolated' as PauseState
  },
  fc.constantFrom('running', 'soft', 'gated', 'isolated')
);

/**
 * Max integer lattice with bounds
 */
export const BoundedIntSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export type BoundedInt = z.infer<typeof BoundedIntSchema>;

export const MaxIntLattice = new ValidatedLattice(
  'MaxInt',
  BoundedIntSchema,
  {
    leq: (a, b) => a <= b,
    join: (a, b) => Math.max(a, b),
    bottom: () => 0,
    top: () => Number.MAX_SAFE_INTEGER
  },
  fc.integer({ min: 0, max: 1000 }) // Use smaller range for testing
);

/**
 * Boolean OR lattice
 */
export const BoolOrLattice = new ValidatedLattice(
  'BoolOr',
  z.boolean(),
  {
    leq: (a, b) => !a || b,
    join: (a, b) => a || b,
    bottom: () => false,
    top: () => true
  },
  fc.boolean()
);

/**
 * Set union lattice with validation
 */
export class SetUnionLattice<T> extends ValidatedLattice<Set<T>, z.ZodType<Set<T>>> {
  constructor(
    elementSchema: z.ZodType<T>,
    elementArbitrary?: fc.Arbitrary<T>
  ) {
    const setSchema = z.set(elementSchema);
    
    super(
      'SetUnion',
      setSchema,
      {
        leq: (a, b) => {
          for (const item of a) {
            if (!b.has(item)) return false;
          }
          return true;
        },
        join: (a, b) => new Set([...a, ...b]),
        bottom: () => new Set(),
        equals: (a, b) => {
          if (a.size !== b.size) return false;
          for (const item of a) {
            if (!b.has(item)) return false;
          }
          return true;
        }
      },
      elementArbitrary ? fc.array(elementArbitrary).map(arr => new Set(arr)) : undefined
    );
  }
}

/**
 * Fence lattice for coordination
 */
export const FenceSchema = z.object({
  fenceIds: z.set(z.string()),
  timestamp: z.number().int().min(0)
});
export type Fence = z.infer<typeof FenceSchema>;

export const FenceLattice = new ValidatedLattice(
  'Fence',
  FenceSchema,
  {
    leq: (a, b) => {
      // a ≤ b if a.fenceIds ⊆ b.fenceIds
      for (const id of a.fenceIds) {
        if (!b.fenceIds.has(id)) return false;
      }
      return a.timestamp <= b.timestamp;
    },
    join: (a, b) => ({
      fenceIds: new Set([...a.fenceIds, ...b.fenceIds]),
      timestamp: Math.max(a.timestamp, b.timestamp)
    }),
    bottom: () => ({
      fenceIds: new Set(),
      timestamp: 0
    }),
    equals: (a, b) => {
      if (a.timestamp !== b.timestamp) return false;
      if (a.fenceIds.size !== b.fenceIds.size) return false;
      for (const id of a.fenceIds) {
        if (!b.fenceIds.has(id)) return false;
      }
      return true;
    }
  },
  fc.record({
    fenceIds: fc.array(fc.string()).map(arr => new Set(arr)),
    timestamp: fc.integer({ min: 0, max: 1000000 })
  })
);

/**
 * Rate limit lattice - composes by taking minimum
 */
export const RateLimitSchema = z.union([
  z.object({
    rps: z.number().positive(),
    burst: z.number().positive().optional()
  }),
  z.null()
]);
export type RateLimit = z.infer<typeof RateLimitSchema>;

export const RateLimitLattice = new ValidatedLattice<RateLimit, typeof RateLimitSchema>(
  'RateLimit',
  RateLimitSchema,
  {
    leq: (a, b) => {
      if (a === null) return true;
      if (b === null) return false;
      return a.rps >= b.rps; // Lower rate is higher in order
    },
    join: (a, b) => {
      if (a === null) return b;
      if (b === null) return a;
      return {
        rps: Math.min(a.rps, b.rps),
        burst: a.burst && b.burst ? Math.min(a.burst, b.burst) : a.burst || b.burst
      };
    },
    bottom: () => null,
    equals: (a, b) => {
      if (a === null && b === null) return true;
      if (a === null || b === null) return false;
      return a.rps === b.rps && a.burst === b.burst;
    }
  },
  fc.option(fc.record({
    rps: fc.float({ min: Math.fround(0.1), max: Math.fround(1000) }),
    burst: fc.option(fc.integer({ min: 1, max: 100 }))
  })) as fc.Arbitrary<RateLimit>
);

// ============================================================================
// Lattice Catalog with Validation
// ============================================================================

export class LatticeCatalog {
  private lattices = new Map<string, Lattice<any, any>>();

  register<T, S extends z.ZodType<T>>(lattice: Lattice<T, S>): void {
    this.lattices.set(lattice.name, lattice);
  }

  get<T = unknown>(name: string): Lattice<T> | undefined {
    return this.lattices.get(name);
  }

  list(): string[] {
    return Array.from(this.lattices.keys());
  }
  
  /**
   * Validate all registered lattices satisfy their laws
   */
  async validateAll(numTests: number = 100): Promise<Map<string, boolean>> {
    const validationResults = new Map<string, boolean>();
    
    for (const [name, lattice] of this.lattices) {
      if (lattice instanceof ValidatedLattice) {
        const tests = lattice.generatePropertyTests();
        const testResults = await Promise.all([
          fc.check(tests.idempotent, { numRuns: numTests }),
          fc.check(tests.commutative, { numRuns: numTests }),
          fc.check(tests.associative, { numRuns: numTests }),
          fc.check(tests.bottomIdentity, { numRuns: numTests }),
          fc.check(tests.ordering, { numRuns: numTests })
        ]);
        const allPassed = testResults.every(r => !r.failed);
        
        validationResults.set(name, allPassed);
      }
    }
    
    return validationResults;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a product lattice from two component lattices
 */
export function productLattice<A, B, SA extends z.ZodType<A>, SB extends z.ZodType<B>>(
  latticeA: Lattice<A, SA>,
  latticeB: Lattice<B, SB>
): ValidatedLattice<[A, B], z.ZodTuple<[SA, SB]>> {
  const schema = z.tuple([latticeA.schema, latticeB.schema]);
  
  return new ValidatedLattice(
    `${latticeA.name}×${latticeB.name}`,
    schema,
    {
      leq: ([a1, b1], [a2, b2]) => 
        latticeA.leq(a1, a2) && latticeB.leq(b1, b2),
      join: ([a1, b1], [a2, b2]) => 
        [latticeA.join(a1, a2), latticeB.join(b1, b2)],
      bottom: () => 
        [latticeA.bottom(), latticeB.bottom()],
      top: latticeA.top && latticeB.top ? 
        () => [latticeA.top!(), latticeB.top!()] : undefined,
      equals: ([a1, b1], [a2, b2]) => {
        const eqA = latticeA instanceof ValidatedLattice ? 
          latticeA.equals(a1, a2) : a1 === a2;
        const eqB = latticeB instanceof ValidatedLattice ? 
          latticeB.equals(b1, b2) : b1 === b2;
        return eqA && eqB;
      }
    },
    latticeA.arbitrary && latticeB.arbitrary ?
      fc.tuple(latticeA.arbitrary, latticeB.arbitrary) : undefined
  );
}

/**
 * Simple number lattice for numeric computations
 * Uses "last-write-wins" semantics rather than max
 */
export const NumberLattice: Lattice<number> = {
  name: 'Number',
  schema: z.number(),
  leq: (a, b) => true, // Always allow updates
  join: (a, b) => b, // Take the new value (last-write-wins)
  bottom: () => 0,
  arbitrary: fc.float({ noNaN: true })
};

/**
 * Create a default catalog with built-in lattices
 */
export function createDefaultCatalog(): LatticeCatalog {
  const catalog = new LatticeCatalog();
  
  catalog.register(PauseLattice);
  catalog.register(MaxIntLattice);
  catalog.register(BoolOrLattice);
  catalog.register(FenceLattice);
  catalog.register(RateLimitLattice);
  catalog.register(NumberLattice);
  
  return catalog;
}

// Export collection of lattices for convenience
export const lattices = {
  PauseLattice,
  MaxIntLattice,
  BoolOrLattice,
  FenceLattice,
  RateLimitLattice,
  NumberLattice
};