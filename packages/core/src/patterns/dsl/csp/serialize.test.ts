/**
 * Tests for CSP Serialization
 */

import { describe, it, expect } from 'vitest';
import { createCSPGadget } from './csp';
import { serialize, fromDescription } from './serialize';
import { quick, withTaps } from '../../../core/context';
import { intersectionProto } from '../../cells';
import { constraintLibrary } from './schema';

describe('CSP Serialization', () => {
  it('should serialize an empty network', () => {
    const csp = createCSPGadget();
    const description = serialize(csp);

    expect(description.type).toBe('csp');
    expect(description.version).toBe('1.0.0');
    expect(Object.keys(description.types)).toHaveLength(0);
    expect(Object.keys(description.variables)).toHaveLength(0);
    expect(Object.keys(description.constraints)).toHaveLength(0);
  });

  it('should serialize type definitions', () => {
    const csp = createCSPGadget();

    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    const description = serialize(csp);

    expect(description.types).toHaveProperty('color');
    expect(description.types.color.domain.type).toBe('intersection');
  });

  it('should serialize variables with domains', () => {
    const csp = createCSPGadget();

    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'v1', type: 'color' } });

    const description = serialize(csp);

    expect(description.variables).toHaveProperty('v1');
    expect(description.variables.v1.type).toBe('color');
    expect(description.variables.v1.domain).toEqual({
      __type: 'Set',
      values: ['R', 'G', 'B']
    });
  });

  it('should round-trip a simple network', () => {
    const csp1 = createCSPGadget();

    // Setup network
    csp1.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp1.receive({ create: { id: 'v1', type: 'color' } });
    csp1.receive({ create: { id: 'v2', type: 'color' } });

    // Serialize
    const description = serialize(csp1);

    // Deserialize
    const csp2 = fromDescription(description);

    // Check structure matches
    const network1 = csp1.current().network;
    const network2 = csp2.current().network;

    const instances1 = network1.current().spawning.current().instances.current();
    const instances2 = network2.current().spawning.current().instances.current();

    expect(instances1.size).toBe(instances2.size);
    expect(instances2.has('v1')).toBe(true);
    expect(instances2.has('v2')).toBe(true);

    // Check domains match
    const v1_1 = instances1.get('v1');
    const v1_2 = instances2.get('v1');

    expect(v1_1?.current()).toEqual(v1_2?.current());
  });

  it('should preserve variable domains through round-trip', () => {
    const csp1 = createCSPGadget();

    csp1.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp1.receive({
      create: {
        id: 'v1',
        type: 'color',
        domain: new Set(['R', 'G']) // Constrained domain
      }
    });

    const description = serialize(csp1);
    const csp2 = fromDescription(description);

    const network2 = csp2.current().network;
    const instances2 = network2.current().spawning.current().instances.current();
    const v1 = instances2.get('v1');

    expect(v1?.current()).toEqual(new Set(['R', 'G']));
  });

  it('should handle Set serialization correctly', () => {
    const csp1 = createCSPGadget();

    csp1.receive({
      variable: {
        name: 'nums',
        domain: () => withTaps(quick(intersectionProto(), new Set([1, 2, 3, 4, 5])))
      }
    });

    csp1.receive({ create: { id: 'x', type: 'nums' } });

    const description = serialize(csp1);

    expect(description.variables.x.domain).toEqual({
      __type: 'Set',
      values: [1, 2, 3, 4, 5]
    });

    const csp2 = fromDescription(description);
    const network2 = csp2.current().network;
    const instances2 = network2.current().spawning.current().instances.current();
    const x = instances2.get('x');

    expect(x?.current()).toEqual(new Set([1, 2, 3, 4, 5]));
  });
});
