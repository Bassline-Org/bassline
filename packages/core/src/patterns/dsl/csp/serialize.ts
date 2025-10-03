/**
 * Serialization for CSP Networks
 *
 * Converts running CSP networks to/from JSON descriptions
 */

import type { CSPDescription, SerializableValue } from './schema';
import { emptyCSPDescription, constraintLibrary } from './schema';
import type { Implements } from '../../../core/context';
import { quick, withTaps } from '../../../core/context';
import type { Valued } from '../../../core/protocols';
import { createCSPGadget } from './csp';
import { intersectionProto, unionProto, maxProto, minProto, lastProto } from '../../cells';

// ================================================
// Serialization Helpers
// ================================================

/**
 * Convert a value to a serializable form
 */
function toSerializable(value: unknown): SerializableValue {
  // Handle Sets specially
  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: Array.from(value).map(toSerializable)
    };
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(toSerializable) as SerializableValue;
  }

  // Handle objects
  if (value && typeof value === 'object') {
    const obj: Record<string, SerializableValue> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = toSerializable(v);
    }
    return obj;
  }

  // Primitives
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  // Unknown type - convert to string
  return String(value);
}

/**
 * Convert a serializable value back to runtime form
 */
function fromSerializable(value: SerializableValue): unknown {
  // Handle Set representation
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    '__type' in value &&
    value.__type === 'Set'
  ) {
    const setData = value as { __type: 'Set'; values: SerializableValue[] };
    return new Set(setData.values.map(fromSerializable));
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(fromSerializable);
  }

  // Handle objects
  if (value && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = fromSerializable(v);
    }
    return obj;
  }

  // Primitives pass through
  return value;
}

// ================================================
// Serialization
// ================================================

/**
 * Serialize a running CSP network to a description
 */
export function serialize(csp: ReturnType<typeof createCSPGadget>): CSPDescription {
  const description = emptyCSPDescription();

  // Introspect the network
  csp.receive({ introspect: {} });

  // Capture introspection result
  let introspected: {
    variables: { id: string; type: string; domain: unknown }[];
    constraints: { id: string; vars: string[] }[];
    types: { name: string }[];
  } | undefined;

  const cleanup = csp.tap(effects => {
    if ('introspected' in effects && effects.introspected) {
      introspected = effects.introspected;
    }
  });

  // Trigger introspection (synchronous)
  csp.receive({ introspect: {} });
  cleanup();

  if (!introspected) {
    throw new Error('Failed to introspect CSP network');
  }

  // Serialize types - use the domain from first variable of each type as the default
  // This is a workaround since we don't track factory initial values
  const typeDomains = new Map<string, SerializableValue>();
  for (const varInfo of introspected.variables) {
    if (!typeDomains.has(varInfo.type)) {
      typeDomains.set(varInfo.type, toSerializable(varInfo.domain));
    }
  }

  for (const typeInfo of introspected.types) {
    const defaultDomain = typeDomains.get(typeInfo.name) || toSerializable(new Set());
    description.types[typeInfo.name] = {
      domain: {
        type: 'intersection', // We're using intersection cells for now
        initialValue: defaultDomain as { __type: 'Set'; values: SerializableValue[] }
      }
    };
  }

  // Serialize variables
  for (const varInfo of introspected.variables) {
    description.variables[varInfo.id] = {
      type: varInfo.type,
      domain: toSerializable(varInfo.domain)
    };
  }

  // Serialize constraints
  // NOTE: We lose constraint function implementations here
  // Only named constraints from the library can be serialized
  for (const constraintInfo of introspected.constraints) {
    description.constraints[constraintInfo.id] = {
      vars: constraintInfo.vars,
      constraint: 'unknown' // TODO: Track constraint names
    };
  }

  return description;
}

// ================================================
// Deserialization
// ================================================

/**
 * Create a CSP network from a description
 */
export function fromDescription(description: CSPDescription): ReturnType<typeof createCSPGadget> {
  const csp = createCSPGadget();

  // 1. Define types
  for (const [name, typeInfo] of Object.entries(description.types)) {
    const { domain } = typeInfo;

    // Create factory based on domain description
    let factory: () => Implements<Valued<unknown>>;

    switch (domain.type) {
      case 'intersection': {
        const initialValue = fromSerializable(domain.initialValue);
        factory = () => withTaps(quick(intersectionProto(), initialValue as Set<unknown>)) as Implements<Valued<unknown>>;
        break;
      }
      case 'union': {
        const initialValue = fromSerializable(domain.initialValue);
        factory = () => withTaps(quick(unionProto(), initialValue as Set<unknown>)) as Implements<Valued<unknown>>;
        break;
      }
      case 'max': {
        factory = () => withTaps(quick(maxProto, domain.initialValue)) as Implements<Valued<unknown>>;
        break;
      }
      case 'min': {
        factory = () => withTaps(quick(minProto, domain.initialValue)) as Implements<Valued<unknown>>;
        break;
      }
      case 'last': {
        const initialValue = fromSerializable(domain.initialValue);
        factory = () => withTaps(quick(lastProto(), initialValue));
        break;
      }
      default:
        throw new Error(`Unknown domain type: ${(domain as { type: string }).type}`);
    }

    csp.receive({ variable: { name, domain: factory } });
  }

  // 2. Create variables
  // NOTE: We currently lose the type information during serialization
  // so we use the first defined type for all variables
  const firstType = Object.keys(description.types)[0];

  for (const [id, varInfo] of Object.entries(description.variables)) {
    // Don't pass domain here - it's already set in the factory's initialValue
    // If we pass it here, intersection cells will intersect with empty → contradiction
    const type = firstType || varInfo.type; // Fallback to stored type if no types defined
    csp.receive({ create: { id, type } });
  }

  // 3. Create constraints
  for (const [id, constraintInfo] of Object.entries(description.constraints)) {
    const constraintFn = constraintLibrary[constraintInfo.constraint as keyof typeof constraintLibrary];

    if (!constraintFn) {
      console.warn(`Unknown constraint: ${constraintInfo.constraint}, skipping`);
      continue;
    }

    csp.receive({
      relate: {
        vars: constraintInfo.vars,
        constraint: constraintFn as (...domains: unknown[]) => unknown[]
      }
    });
  }

  return csp;
}
