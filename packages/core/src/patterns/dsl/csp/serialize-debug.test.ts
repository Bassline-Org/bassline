/**
 * Debug tests for serialization helpers
 */

import { describe, it, expect } from 'vitest';

// Import the helpers directly - we'll need to export them from serialize.ts
import { serialize, fromDescription } from './serialize';
import { createCSPGadget } from './csp';
import { quick, withTaps } from '../../../core/context';
import { intersectionProto } from '../../cells';

describe('Serialization Helpers Debug', () => {
  it('should verify Set serialization format', () => {
    const csp = createCSPGadget();

    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'v1', type: 'color' } });

    const description = serialize(csp);

    console.log('Serialized description:', JSON.stringify(description, null, 2));

    // Check the format
    expect(description.types.color.domain.initialValue).toEqual({
      __type: 'Set',
      values: expect.arrayContaining(['R', 'G', 'B'])
    });

    expect(description.variables.v1.domain).toEqual({
      __type: 'Set',
      values: expect.arrayContaining(['R', 'G', 'B'])
    });
  });

  it('should verify factory creates correct initial values', () => {
    const csp = createCSPGadget();

    csp.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp.receive({ create: { id: 'test1', type: 'color' } });
    csp.receive({ create: { id: 'test2', type: 'color' } });

    const network = csp.current().network;
    const instances = network.current().spawning.current().instances.current();

    const test1 = instances.get('test1');
    const test2 = instances.get('test2');

    console.log('test1 domain:', test1?.current());
    console.log('test2 domain:', test2?.current());

    expect(test1?.current()).toEqual(new Set(['R', 'G', 'B']));
    expect(test2?.current()).toEqual(new Set(['R', 'G', 'B']));
  });

  it('should trace deserialization step by step', () => {
    const csp1 = createCSPGadget();

    csp1.receive({
      variable: {
        name: 'color',
        domain: () => withTaps(quick(intersectionProto(), new Set(['R', 'G', 'B'])))
      }
    });

    csp1.receive({ create: { id: 'v1', type: 'color' } });

    const description = serialize(csp1);
    console.log('\n=== SERIALIZED ===');
    console.log(JSON.stringify(description, null, 2));

    const csp2 = fromDescription(description);

    console.log('\n=== CHECKING DESERIALIZED ===');
    const network2 = csp2.current().network;
    const definitions2 = network2.current().definitions.current();
    const instances2 = network2.current().spawning.current().instances.current();

    console.log('Definitions:', Array.from(definitions2.keys()));
    console.log('Instances:', Array.from(instances2.keys()));

    const v1 = instances2.get('v1');
    console.log('v1 exists:', !!v1);
    console.log('v1 current:', v1?.current());

    expect(v1).toBeDefined();
    expect(v1?.current()).toEqual(new Set(['R', 'G', 'B']));
  });
});
