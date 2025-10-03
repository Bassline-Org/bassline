/**
 * JSON Schema for CSP Descriptions
 *
 * Defines the shape of serialized CSP networks
 */

// ================================================
// Serializable Types (JSON-compatible)
// ================================================

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableArray
  | SerializableObject
  | SerializableSet;

interface SerializableArray extends Array<SerializableValue> { }
interface SerializableObject {
  [key: string]: SerializableValue;
}
// Sets are serialized as arrays with a type tag
type SerializableSet = { __type: 'Set'; values: SerializableValue[] };

// ================================================
// CSP Description Type
// ================================================

export type CSPDescription = {
  type: 'csp';
  version: string;
  types: {
    [name: string]: {
      domain: DomainDescription;
    };
  };
  variables: {
    [id: string]: {
      type: string;
      domain?: SerializableValue;
    };
  };
  constraints: {
    [id: string]: {
      vars: string[];
      constraint: string; // Named constraint from library
      params?: Record<string, SerializableValue>;
    };
  };
};

export type DomainDescription =
  | { type: 'intersection'; initialValue: SerializableSet }
  | { type: 'union'; initialValue: SerializableSet }
  | { type: 'max'; initialValue: number }
  | { type: 'min'; initialValue: number }
  | { type: 'last'; initialValue: SerializableValue };

// ================================================
// Constraint Library
// ================================================

export type ConstraintFunction<T = unknown> = (...domains: Set<T>[]) => Set<T>[];

export const constraintLibrary = {
  /**
   * Not Equal: Variables must have different values
   * For sets: remove overlapping values from each
   */
  notEqual: <T>(d1: Set<T>, d2: Set<T>): [Set<T>, Set<T>] => {
    const refined1 = d2.size === 1
      ? new Set([...d1].filter(x => !d2.has(x)))
      : d1;
    const refined2 = d1.size === 1
      ? new Set([...d2].filter(x => !d1.has(x)))
      : d2;
    return [refined1, refined2];
  },

  /**
   * All Different: All variables must have different values
   * For N variables with sets
   */
  allDifferent: <T>(...domains: Set<T>[]): Set<T>[] => {
    // For each domain, remove values that are decided in other domains
    return domains.map((d, i) => {
      const decided = new Set<T>();
      domains.forEach((otherD, j) => {
        if (i !== j && otherD.size === 1) {
          otherD.forEach(v => decided.add(v));
        }
      });
      return new Set([...d].filter(x => !decided.has(x)));
    });
  },

  /**
   * Less Than: First variable < second variable
   * For numeric ranges
   */
  lessThan: (d1: Set<number>, d2: Set<number>): [Set<number>, Set<number>] => {
    const maxD1 = Math.max(...d1);
    const minD2 = Math.min(...d2);
    return [
      new Set([...d1].filter(x => x < minD2)),
      new Set([...d2].filter(x => x > maxD1))
    ];
  },

  /**
   * Sum Equals: Sum of all variables equals target
   * Last parameter is the target sum
   */
  sumEquals: (target: number, ...domains: Set<number>[]): Set<number>[] => {
    // Refine each domain based on possible sums
    return domains.map((d, i) => {
      const otherSum = domains.reduce((sum, otherD, j) => {
        if (i === j) return sum;
        return sum + Math.min(...otherD);
      }, 0);
      const maxAllowed = target - otherSum;
      return new Set([...d].filter(x => x <= maxAllowed));
    });
  }
} as const;

// ================================================
// JSON Schema (for validation)
// ================================================

export const cspJSONSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['type', 'version', 'types', 'variables', 'constraints'],
  properties: {
    type: {
      type: 'string',
      enum: ['csp']
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$'
    },
    types: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: ['intersection', 'union', 'max', 'min', 'last']
              },
              initialValue: {}
            }
          }
        }
      }
    },
    variables: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string' },
          domain: {}
        }
      }
    },
    constraints: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['vars', 'constraint'],
        properties: {
          vars: {
            type: 'array',
            items: { type: 'string' }
          },
          constraint: {
            type: 'string'
          },
          params: {
            type: 'object'
          }
        }
      }
    }
  }
};

// ================================================
// Helpers
// ================================================

/**
 * Validate a CSP description against the schema
 */
export function validateCSPDescription(desc: unknown): desc is CSPDescription {
  // Basic structural validation
  if (!desc || typeof desc !== 'object') return false;

  const candidate = desc as Record<string, unknown>;

  if (candidate.type !== 'csp') return false;
  if (!candidate.version || typeof candidate.version !== 'string') return false;
  if (!candidate.types || typeof candidate.types !== 'object') return false;
  if (!candidate.variables || typeof candidate.variables !== 'object') return false;
  if (!candidate.constraints || typeof candidate.constraints !== 'object') return false;

  // Validate constraint references
  const constraints = candidate.constraints as Record<string, unknown>;
  for (const constraintId in constraints) {
    const constraint = constraints[constraintId] as Record<string, unknown>;
    if (!constraint.constraint || typeof constraint.constraint !== 'string' || !(constraint.constraint in constraintLibrary)) {
      return false;
    }
  }

  return true;
}

/**
 * Create empty CSP description
 */
export function emptyCSPDescription(): CSPDescription {
  return {
    type: 'csp',
    version: '1.0.0',
    types: {},
    variables: {},
    constraints: {}
  };
}
